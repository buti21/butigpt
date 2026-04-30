import { useEffect, useRef, useState } from "react";
import { Sidebar, SidebarToggleFloating, type Conversation } from "@/components/buti/Sidebar";
import { Welcome } from "@/components/buti/Welcome";
import { MessageBubble, type ChatMessage } from "@/components/buti/MessageBubble";
import { ChatInput } from "@/components/buti/ChatInput";
import { ButiLogo } from "@/components/buti/ButiLogo";
import { toast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const uid = () => Math.random().toString(36).slice(2, 10);

interface ConversationState extends Conversation {
  messages: ChatMessage[];
}

const Index = () => {
  const [conversations, setConversations] = useState<ConversationState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mobile: closed by default
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Auto-scroll to bottom on new content
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

  const send = async (text: string) => {
    let convId = activeId;
    if (!convId) convId = newConversation();

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const assistantId = uid();

    updateConv(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      updatedAt: Date.now(),
      messages: [...c.messages, userMsg, { id: assistantId, role: "assistant", content: "" }],
    }));

    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build payload from latest state of this conv (include the new user msg)
      const conv = conversations.find((c) => c.id === convId);
      const history = (conv?.messages ?? []).map((m) => ({ role: m.role, content: m.content }));
      const payloadMessages = [...history, { role: "user", content: text }];

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
          toast({ title: "Prea multe cereri", description: "Așteaptă câteva secunde și încearcă din nou.", variant: "destructive" });
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

  const messages = active?.messages ?? [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
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

        <ChatInput onSend={send} onStop={stop} isStreaming={isStreaming} />
      </main>
    </div>
  );
};

export default Index;
