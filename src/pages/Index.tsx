import { useEffect, useRef, useState, DragEvent } from "react";
import { Sidebar, SidebarToggleFloating, type Conversation } from "@/components/buti/Sidebar";
import { Welcome } from "@/components/buti/Welcome";
import { MessageBubble, type ChatMessage } from "@/components/buti/MessageBubble";
import { ChatInput, type AttachedImage, type AttachedFile } from "@/components/buti/ChatInput";
import { ButiLogo } from "@/components/buti/ButiLogo";
import { UserMenu } from "@/components/buti/UserMenu";
import { SettingsDialog } from "@/components/buti/SettingsDialog";
import { ShareDialog } from "@/components/buti/ShareDialog";
import { VoiceCallDialog } from "@/components/buti/VoiceCallDialog";

import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { extractPresentationSpec, stripPresentationBlock } from "@/lib/pptx";
import { ImagePlus } from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const TITLE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/title`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Typewriter pacing — natural variable-speed typing
const TYPEWRITER_BASE_MS = 8;
const TYPEWRITER_PUNCT_PAUSE_MS = 90;
const TYPEWRITER_COMMA_PAUSE_MS = 40;
const TYPEWRITER_NEWLINE_PAUSE_MS = 60;
const TYPEWRITER_CATCHUP_THRESHOLD = 120;
const TYPEWRITER_MAX_CHARS_PER_TICK = 6;

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);


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

const STORAGE_KEY = "butigpt:conversations:v1";
const ACTIVE_KEY = "butigpt:active:v1";
const DELETED_QUEUE_KEY = "butigpt:deleted-queue:v1";

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const loadDeletedQueue = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const saveDeletedQueue = (ids: string[]) => {
  try {
    localStorage.setItem(DELETED_QUEUE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
};

const Index = () => {
  const [conversations, setConversations] = useState<ConversationState[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ConversationState[];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const {
    typewriterSpeed,
    model: modelChoice,
    saveHistory,
    language,
    tone,
    customInstructions,
    aboutYou,
    followUps,
    enterToSend,
  } = useSettings();
  const speedMul =
    typewriterSpeed === "slow" ? 2.2 :
    typewriterSpeed === "fast" ? 0.4 :
    typewriterSpeed === "instant" ? 0 : 1;

  const buildSystemExtras = () => {
    const parts: string[] = [];
    const langMap: Record<string, string> = {
      ro: "Răspunde mereu în limba română.",
      en: "Always respond in English.",
      fr: "Réponds toujours en français.",
      es: "Responde siempre en español.",
      de: "Antworte immer auf Deutsch.",
      it: "Rispondi sempre in italiano.",
    };
    if (language !== "auto" && langMap[language]) parts.push(langMap[language]);
    const toneMap: Record<string, string> = {
      casual: "Adoptă un ton relaxat, prietenos, ca între prieteni.",
      formal: "Folosește un ton formal, profesionist și politicos.",
      concise: "Răspunde cât mai concis posibil — fără introducere, doar esența.",
      playful: "Folosește un ton jucăuș, cu umor subtil și emoji ocazionale.",
      expert: "Răspunde ca un expert în domeniu, cu detalii tehnice riguroase.",
    };
    if (tone !== "default" && toneMap[tone]) parts.push(toneMap[tone]);
    if (aboutYou.trim()) parts.push(`Despre utilizator: ${aboutYou.trim()}`);
    if (customInstructions.trim()) parts.push(`Instrucțiuni: ${customInstructions.trim()}`);
    if (followUps) parts.push("La finalul fiecărui răspuns, adaugă o secțiune „Următoarele întrebări:” cu 2-3 sugestii scurte de follow-up, fiecare pe rând nou, prefixată cu „→ ”.");
    return parts.join("\n\n");
  };


  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  const deletedIdsRef = useRef<Set<string>>(new Set(loadDeletedQueue()));

  const abortRef = useRef<AbortController | null>(null);
  const stopFlagRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const isAutoScrollingRef = useRef(false);

  // Used by ChatInput-less drop: queue files until the input picks them up.
  const [pendingDropImages, setPendingDropImages] = useState<AttachedImage[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  // === Cloud sync: swap state when auth user changes ===
  useEffect(() => {
    const currentId = user?.id ?? null;
    if (currentId === userIdRef.current) return;
    userIdRef.current = currentId;

    if (currentId) {
      // logged in: load from DB
      (async () => {
        const { data, error } = await supabase
          .from("conversations")
          .select("id, title, updated_at, messages")
          .order("updated_at", { ascending: false });
        if (error) {
          console.error("load conversations", error);
          return;
        }
        const filtered = (data ?? []).filter((r) => !deletedIdsRef.current.has(r.id));
        const loaded: ConversationState[] = filtered.map((row) => ({
          id: row.id,
          title: row.title,
          updatedAt: new Date(row.updated_at).getTime(),
          messages: (Array.isArray(row.messages) ? row.messages : []) as unknown as ChatMessage[],
        }));
        setConversations(loaded);
        setActiveId(loaded[0]?.id ?? null);

        // Retry any pending deletes from previous sessions
        const pending = Array.from(deletedIdsRef.current).filter(isUuid);
        if (pending.length) {
          const { error: delErr } = await supabase
            .from("conversations")
            .delete()
            .in("id", pending);
          if (!delErr) {
            deletedIdsRef.current.clear();
            saveDeletedQueue([]);
          }
        }
      })();
    } else {
      // logged out: restore from localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setConversations(Array.isArray(parsed) ? parsed : []);
        setActiveId(localStorage.getItem(ACTIVE_KEY));
      } catch {
        setConversations([]);
        setActiveId(null);
      }
    }
  }, [user]);

  // Persist conversations & active id (localStorage = offline cache)
  useEffect(() => {
    if (!saveHistory) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      /* quota or serialization */
    }
  }, [conversations, saveHistory]);
  useEffect(() => {
    if (!saveHistory) return;
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeId, saveHistory]);

  // Debounced cloud sync when logged in (skip while streaming or history disabled)
  useEffect(() => {
    if (!user || isStreaming || !saveHistory) return;
    const t = window.setTimeout(() => {
      // Process pending deletions FIRST so the server can't resurrect rows on refresh
      const pendingDeletes = Array.from(deletedIdsRef.current).filter(isUuid);
      if (pendingDeletes.length) {
        supabase
          .from("conversations")
          .delete()
          .in("id", pendingDeletes)
          .then(({ error }) => {
            if (error) {
              console.error("delete sync error", error);
            } else {
              pendingDeletes.forEach((id) => deletedIdsRef.current.delete(id));
              saveDeletedQueue(Array.from(deletedIdsRef.current));
            }
          });
      }

      const rows = conversations
        .filter((c) => isUuid(c.id))
        .map((c) => ({
          id: c.id,
          user_id: user.id,
          title: c.title,
          messages: c.messages as unknown as import("@/integrations/supabase/types").Json,
          updated_at: new Date(c.updatedAt).toISOString(),
        }));

      if (!rows.length) return;
      supabase
        .from("conversations")
        .upsert(rows, { onConflict: "id" })
        .then(({ error }) => {
          if (error) console.error("sync error", error);
        });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [conversations, user, isStreaming, saveHistory]);


  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Track whether user is near bottom — if not, don't auto-scroll.
  // Ignore scroll events triggered by our own programmatic scrolling.
  const handleScroll = () => {
    if (isAutoScrollingRef.current) {
      isAutoScrollingRef.current = false;
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  };

  // Auto-scroll only if user is near bottom (no smooth during streaming for perf)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    isAutoScrollingRef.current = true;
    el.scrollTop = el.scrollHeight;
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
    // Queue for guaranteed cloud deletion (retried on next sync/login)
    if (isUuid(id)) {
      deletedIdsRef.current.add(id);
      saveDeletedQueue(Array.from(deletedIdsRef.current));
    }
    if (user && isUuid(id)) {
      supabase.from("conversations").delete().eq("id", id).then(({ error }) => {
        if (error) {
          console.error("delete error", error);
        } else {
          deletedIdsRef.current.delete(id);
          saveDeletedQueue(Array.from(deletedIdsRef.current));
        }
      });
    }
  };

  const clearAllConversations = async () => {
    const ids = conversations.map((c) => c.id);
    setConversations([]);
    setActiveId(null);
    const uuidIds = ids.filter(isUuid);
    uuidIds.forEach((i) => deletedIdsRef.current.add(i));
    saveDeletedQueue(Array.from(deletedIdsRef.current));
    if (user && uuidIds.length) {
      const { error } = await supabase.from("conversations").delete().in("id", uuidIds);
      if (error) {
        console.error("clear all error", error);
      } else {
        uuidIds.forEach((i) => deletedIdsRef.current.delete(i));
        saveDeletedQueue(Array.from(deletedIdsRef.current));
      }
    }
    toast({ title: "Conversații șterse", description: "Toate conversațiile au fost eliminate." });
  };

  const exportConversations = () => {
    const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `butigpt-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };


  const updateConv = (id: string, updater: (c: ConversationState) => ConversationState) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const stop = () => {
    stopFlagRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const generateTitle = async (convId: string, userMessage: string, assistantMessage: string) => {
    try {
      const resp = await fetch(TITLE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ userMessage, assistantMessage }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const title = (data?.title as string | null)?.trim();
      if (title) {
        updateConv(convId, (c) => ({ ...c, title }));
      }
    } catch {
      /* ignore */
    }
  };

  const send = async (text: string, attachments: AttachedImage[] = [], docFiles: AttachedFile[] = []) => {
    let convId = activeId;
    if (!convId) convId = newConversation();

    const imageUrls = attachments.map((a) => a.dataUrl);

    // Build the user-visible text (what we show in the bubble) and the
    // model-facing text (which includes extracted file contents).
    const visibleText = text;
    let modelText = text;
    if (docFiles.length) {
      const blocks = docFiles
        .map(
          (f) =>
            `[Conținutul fișierului "${f.parsed.name}" (${f.parsed.kind})${
              f.parsed.truncated ? ", truncat" : ""
            }]:\n${f.parsed.text}`,
        )
        .join("\n\n");
      modelText = `${blocks}${text ? `\n\n---\n\n${text}` : ""}`.trim();
    }

    const fileBadge = docFiles.length
      ? `📎 ${docFiles.map((f) => f.parsed.name).join(", ")}`
      : "";
    const userBubbleText = [fileBadge, visibleText].filter(Boolean).join("\n\n");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: userBubbleText,
      images: imageUrls.length ? imageUrls : undefined,
      createdAt: Date.now(),
    };
    const assistantId = uid();

    // Snapshot whether this is the first exchange — used to trigger title gen
    let isFirstExchange = false;

    updateConv(convId, (c) => {
      isFirstExchange = c.messages.length === 0;
      const titleSeed =
        text ||
        (docFiles[0]?.parsed.name) ||
        (imageUrls.length ? `Imagine (${imageUrls.length})` : "Conversație nouă");
      return {
        ...c,
        title:
          c.messages.length === 0
            ? titleSeed.slice(0, 40)
            : c.title,
        updatedAt: Date.now(),
        messages: [
          ...c.messages,
          userMsg,
          { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
        ],
      };
    });

    // When user sends a new message, force scroll to bottom
    stickToBottomRef.current = true;

    stopFlagRef.current = false;
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // ===== Typewriter buffer: chars arrive into `target`, get drained slowly into UI =====
    let target = "";
    let displayed = "";
    let typewriterTimer: number | null = null;
    let streamFinished = false;
    const baseMs = Math.max(0, TYPEWRITER_BASE_MS * speedMul);
    const punctMs = TYPEWRITER_PUNCT_PAUSE_MS * speedMul;
    const commaMs = TYPEWRITER_COMMA_PAUSE_MS * speedMul;
    const nlMs = TYPEWRITER_NEWLINE_PAUSE_MS * speedMul;
    const instant = speedMul === 0;

    const scheduleTypewriter = () => {
      if (typewriterTimer !== null) return;
      const tick = () => {
        typewriterTimer = null;
        if (displayed.length >= target.length) {
          if (!streamFinished) {
            typewriterTimer = window.setTimeout(tick, baseMs || 16);
          }
          return;
        }
        const remaining = target.length - displayed.length;
        const chunkSize = instant
          ? remaining
          : Math.min(
              TYPEWRITER_MAX_CHARS_PER_TICK,
              Math.max(1, Math.floor(remaining / TYPEWRITER_CATCHUP_THRESHOLD) + 1),
            );
        const next = Math.min(displayed.length + chunkSize, target.length);
        const justTyped = target.slice(displayed.length, next);
        displayed = target.slice(0, next);
        const snapshot = displayed;
        updateConv(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: snapshot } : m,
          ),
        }));

        const lastChar = justTyped.slice(-1);
        let delay = baseMs;
        if (".!?:;".includes(lastChar)) delay += punctMs;
        else if (",–—".includes(lastChar)) delay += commaMs;
        else if (lastChar === "\n") delay += nlMs;

        typewriterTimer = window.setTimeout(tick, delay);
      };
      typewriterTimer = window.setTimeout(tick, baseMs);
    };
    const flushTypewriter = scheduleTypewriter;


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
        { role: "user", content: buildUserApiContent(modelText, imageUrls) },
      ];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ messages: payloadMessages, model: modelChoice, systemExtras: buildSystemExtras() }),
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

      flushTypewriter();

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        if (stopFlagRef.current) {
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
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

            // Custom event: generated image — bypass typewriter
            if (parsed.buti_image?.url) {
              const url = parsed.buti_image.url as string;
              updateConv(convId!, (c) => ({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, images: [...(m.images ?? []), url] }
                    : m,
                ),
              }));
              continue;
            }

            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              target += delta;
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Mark stream done — typewriter will stop after draining
      streamFinished = true;

      // Wait for typewriter to fully drain (or user pressed stop)
      await new Promise<void>((resolve) => {
        const check = window.setInterval(() => {
          if (stopFlagRef.current || displayed.length >= target.length) {
            window.clearInterval(check);
            resolve();
          }
        }, 30);
      });

      if (stopFlagRef.current) {
        // Snap to whatever was already streamed
        const snap = target;
        updateConv(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: snap } : m,
          ),
        }));
      }

      // Detect a presentation spec block in the final text. If found, attach
      // it to the assistant message and strip the JSON block from the displayed
      // content so the user sees a clean message + a download card.
      const presSpec = extractPresentationSpec(target);
      if (presSpec) {
        const cleaned = stripPresentationBlock(target) ||
          `Am pregătit prezentarea „${presSpec.title}". Apasă mai jos pentru a o descărca.`;
        target = cleaned;
        displayed = cleaned;
        updateConv(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: cleaned, presentation: presSpec }
              : m,
          ),
        }));
      }

      // Trigger title generation after first exchange completes
      if (isFirstExchange && target.trim()) {
        generateTitle(convId!, text || docFiles.map((f) => f.parsed.name).join(", "), target);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast({ title: "Eroare de rețea", description: "Verifică conexiunea și reîncearcă.", variant: "destructive" });
      }
      // On abort, snap to whatever we have
      streamFinished = true;
      if (target.length > displayed.length) {
        const snap = target;
        updateConv(convId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: snap } : m,
          ),
        }));
      }
    } finally {
      if (typewriterTimer !== null) {
        window.clearTimeout(typewriterTimer);
      }
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
      className="relative flex h-[100dvh] w-full overflow-hidden bg-background text-foreground"
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
        onShare={(c) => {
          if (!user) {
            toast({
              title: "Conectează-te pentru a partaja",
              description: "Linkurile publice necesită un cont.",
              variant: "destructive",
            });
            return;
          }
          setShareTarget({ id: c.id, title: c.title });
        }}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((s) => !s)}
        onOpenSettings={() => setSettingsOpen(true)}
        onStartVoiceCall={() => {
          setVoiceCallOpen(true);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        conversationsCount={conversations.length}
        onExport={exportConversations}
        onClearAll={clearAllConversations}
      />

      <ShareDialog
        open={!!shareTarget}
        onOpenChange={(o) => !o && setShareTarget(null)}
        conversationId={shareTarget?.id ?? null}
        conversationTitle={shareTarget?.title}
      />

      <VoiceCallDialog open={voiceCallOpen} onOpenChange={setVoiceCallOpen} />



      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-3 sm:px-4 py-3 backdrop-blur-md pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]">
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
          <UserMenu />
        </header>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-thin">
          <div
            key={activeId ?? "welcome"}
            className="h-full animate-screen-in"
          >
            {!activeId || messages.length === 0 ? (
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
        </div>



        <ChatInput
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          externalImages={pendingDropImages}
          onConsumeExternal={() => setPendingDropImages([])}
          enterToSend={enterToSend}
        />
      </main>
    </div>
  );
};

export default Index;
