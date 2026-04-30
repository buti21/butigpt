import { useEffect, useRef, useState, DragEvent } from "react";
import { Sidebar, SidebarToggleFloating, type Conversation } from "@/components/buti/Sidebar";
import { Welcome } from "@/components/buti/Welcome";
import { MessageBubble, type ChatMessage } from "@/components/buti/MessageBubble";
import { ChatInput, type AttachedImage } from "@/components/buti/ChatInput";
import { ButiLogo } from "@/components/buti/ButiLogo";
import { toast } from "@/hooks/use-toast";
import { ImagePlus } from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const uid = () => Math.random().toString(36).slice(2, 10);

interface ConversationState extends Conversation {
  messages: ChatMessage[];
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

// Build multimodal API content for a single user turn
const buildUserApiContent = (text: string, images: string[]) => {
  if (images.length === 0) return text;
  const parts: any[] = images.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));
  if (text) parts.push({ type: "text", text });
  return parts;
};

const Index = () => {
  const [conversations, setConversations] = useState<ConversationState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingDropRef = useRef<((files: File[]) => void) | null>(null);

  // Used by ChatInput-less drop: queue files until the input picks them up.
  // Simpler approach: directly create attached images and send via a pending state.
  const [pendingDropImages, setPendingDropImages] = useState<AttachedImage[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, active?.messages[active.messages.length - 1]?.content]);

  const newConversation = (): string => {
    const id = uid();
    const conv: ConversationState = {
      id,
      title: "Conversație nouă",
      updatedAt: Date.now(),
      messages: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const updateConv = (id: string, updater: (c: ConversationState) => ConversationState) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const send = async (text: string, attachments: AttachedImage[] = []) => {
    let convId = activeId;
    if (!convId) convId = newConversation();

    const imageUrls = attachments.map((a) => a.dataUrl);

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      images: imageUrls.length ? imageUrls : undefined,
    };
    const assistantId = uid();

    updateConv(convId, (c) => ({
      ...c,
      title:
        c.messages.length === 0
          ? (text ? text.slice(0, 40) : `Imagine (${imageUrls.length})`)
          : c.title,
      updatedAt: Date.now(),
      messages: [
        ...c.messages,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ],
    }));

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const conv = conversations.find((c) => c.id === convId);
      const history = (conv?.messages ?? []).map((m) => ({
        role: m.role,
        content:
          m.role === "user" && m.images && m.images.length
            ? buildUserApiContent(m.content, m.images)
            : m.content,
      }));
      const payloadMessages = [
        ...history,
        { role: "user", content: buildUserApiContent(text, imageUrls) },
      ];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ messages: payloadMessages }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast({ title: "Prea multe cereri", description: "Așteaptă câteva secunde.", variant: "destructive" });
        } else if (resp.status === 402) {
          toast({ title: "Credit AI epuizat", description: "Adaugă fonduri în workspace-ul Lovable.", variant: "destructive" });
        } else {
          toast({ title: "Eroare", description: "Nu am putut trimite mesajul.", variant: "destructive" });
        }
        updateConv(convId, (c) => ({
          ...c,
          messages: c.messages.filter((m) => m.id !== assistantId),
        }));
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";
      let done = false;

      while (!done) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assembled += delta;
              updateConv(convId!, (c) => ({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: assembled } : m,
                ),
              }));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast({ title: "Eroare de rețea", description: "Verifică conexiunea și reîncearcă.", variant: "destructive" });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  // ===== Drag & drop on whole window =====
  const onDragEnter = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    dragCounter.current += 1;
    setIsDragging(true);
  };
  const onDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const additions: AttachedImage[] = [];
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f);
        additions.push({ id: uid(), dataUrl, name: f.name, size: f.size });
      } catch {
        /* ignore */
      }
    }
    if (additions.length) {
      setPendingDropImages((prev) => [...prev, ...additions]);
      toast({
        title: `${additions.length} imagine${additions.length > 1 ? "i" : ""} atașat${additions.length > 1 ? "e" : "ă"}`,
        description: "Scrie un mesaj și apasă Enter pentru a trimite.",
      });
    }
  };

  const messages = active?.messages ?? [];

  return (
    <div
      className="relative flex h-screen w-full overflow-hidden bg-background text-foreground"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-surface-1 px-10 py-8 shadow-glow">
            <ImagePlus className="h-10 w-10 text-primary" />
            <div className="text-center">
              <div className="text-base font-semibold">Eliberează pentru a atașa</div>
              <div className="text-sm text-muted-foreground">Imaginile vor fi adăugate la mesaj</div>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        conversations={conversations.map(({ messages: _m, ...rest }) => rest)}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onNew={() => {
          newConversation();
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        onDelete={deleteConversation}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((s) => !s)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {!sidebarOpen && <SidebarToggleFloating onClick={() => setSidebarOpen(true)} />}
            <div className="flex items-center gap-2">
              <ButiLogo className="h-8 w-8" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">ButiGPT</div>
                <div className="text-[11px] text-muted-foreground">Asistent AI personal</div>
              </div>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <Welcome onPick={(p) => send(p)} />
          ) : (
            <div className="pb-6">
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={
                    isStreaming &&
                    i === messages.length - 1 &&
                    m.role === "assistant"
                  }
                />
              ))}
            </div>
          )}
        </div>

        <ChatInput
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          externalImages={pendingDropImages}
          onConsumeExternal={() => setPendingDropImages([])}
        />
      </main>
    </div>
  );
};

export default Index;
