import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ButiLogo } from "./ButiLogo";
import { User, Copy, Check, Volume2, Loader2, Square, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTTS } from "@/hooks/use-tts";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { ImageLightbox } from "./ImageLightbox";
import {
  buildPresentation,
  downloadBlob,
  safeFilename,
  type PresentationSpec,
} from "@/lib/pptx";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  images?: string[];
  presentation?: PresentationSpec;
  createdAt?: number;
}

interface Props {
  message: ChatMessage;
  streaming?: boolean;
}

const formatTime = (ts: number) => {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export const MessageBubble = ({ message, streaming }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { isLoading: ttsLoading, isPlaying, play, stop } = useTTS();
  const { compactMode, showTimestamps, autoTts } = useSettings();
  const autoPlayedRef = useRef(false);

  // Auto TTS for assistant messages once streaming completes
  useEffect(() => {
    if (autoTts && !isUser && !streaming && message.content && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      play(message.content);
    }
  }, [autoTts, isUser, streaming, message.content, play]);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Nu am putut copia",
        description: "Încearcă din nou.",
        variant: "destructive",
      });
    }
  };

  const handleSpeak = () => {
    if (isPlaying || ttsLoading) {
      stop();
    } else {
      play(message.content);
    }
  };

  // Hide actions while streaming for assistant (incomplete content)
  const showActions = !!message.content && !streaming;


  return (
    <div className="w-full">
      <div className={"mx-auto flex max-w-3xl gap-4 px-4 " + (compactMode ? "py-2" : "py-5")}>
        <div className="flex-shrink-0 pt-1">
          {isUser ? (
            <div className={"flex items-center justify-center rounded-xl bg-secondary text-foreground " + (compactMode ? "h-7 w-7" : "h-9 w-9")}>
              <User className={compactMode ? "h-3.5 w-3.5" : "h-4 w-4"} />
            </div>
          ) : (
            <ButiLogo className={compactMode ? "h-7 w-7" : "h-9 w-9"} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{isUser ? "Tu" : "ButiGPT"}</span>
            {showTimestamps && message.createdAt && (
              <span className="text-[10px] font-normal opacity-70">{formatTime(message.createdAt)}</span>
            )}
          </div>


          {isUser ? (
            <div className="space-y-3">
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.images.map((src, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setLightboxSrc(src)}
                      className="block overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform hover:scale-[1.02] cursor-zoom-in"
                    >
                      <img
                        src={src}
                        alt={`Imagine atașată ${i + 1}`}
                        className="max-h-64 max-w-[60vw] sm:max-w-xs object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
                  {message.content}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {streaming && !message.content ? (
                <ThinkingIndicator />
              ) : (
                <div className="buti-prose break-words">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {message.content || "…"}
                  </ReactMarkdown>
                </div>
              )}
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {message.images.map((src, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setLightboxSrc(src)}
                      className="block overflow-hidden rounded-xl border border-border bg-surface-2 shadow-soft transition-transform hover:scale-[1.01] cursor-zoom-in"
                    >
                      <img
                        src={src}
                        alt={`Imagine generată ${i + 1}`}
                        className="max-h-96 max-w-[80vw] sm:max-w-md object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
              {message.presentation && !streaming && (
                <PresentationCard spec={message.presentation} />
              )}
            </div>
          )}

          {showActions && (
            <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity hover:opacity-100">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Copiază mesajul"
                title="Copiază"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>

              {!isUser && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleSpeak}
                  className="h-7 w-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={isPlaying ? "Oprește citirea" : "Citește cu voce tare"}
                  title={isPlaying ? "Oprește citirea" : "Citește cu voce tare"}
                >
                  {ttsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isPlaying ? (
                    <Square className="h-3.5 w-3.5 fill-current text-primary" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
};

const ThinkingIndicator = () => {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = window.setInterval(() => {
      setDots((d) => (d >= 3 ? 1 : d + 1));
    }, 400);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center text-muted-foreground italic select-none">
      <span>Se gândește</span>
      <span className="ml-0.5 inline-block w-6 text-left">{".".repeat(dots)}</span>
    </div>
  );
};

const PresentationCard = ({ spec }: { spec: PresentationSpec }) => {
  const [busy, setBusy] = useState(false);
  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await buildPresentation(spec);
      downloadBlob(blob, `${safeFilename(spec.title)}.pptx`);
    } catch (e) {
      console.error(e);
      toast({
        title: "Nu am putut crea prezentarea",
        description: "Încearcă din nou.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  const slideCount = spec.slides?.length ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 shadow-soft">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">
          {spec.title}
        </div>
        <div className="text-xs text-muted-foreground">
          Prezentare PowerPoint • {slideCount} slide{slideCount === 1 ? "" : "-uri"}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={handleDownload}
        disabled={busy}
        className="flex-shrink-0 rounded-lg bg-gradient-primary text-primary-foreground hover:opacity-90"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Download className="mr-1.5 h-4 w-4" />
            Descarcă
          </>
        )}
      </Button>
    </div>
  );
};
