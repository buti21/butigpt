import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ButiLogo } from "./ButiLogo";
import { User, Copy, Check, Volume2, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTTS } from "@/hooks/use-tts";
import { toast } from "@/hooks/use-toast";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  images?: string[];
}

interface Props {
  message: ChatMessage;
  streaming?: boolean;
}

export const MessageBubble = ({ message, streaming }: Props) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const { isLoading: ttsLoading, isPlaying, play, stop } = useTTS();

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
      <div className="mx-auto flex max-w-3xl gap-4 px-4 py-5">
        <div className="flex-shrink-0 pt-1">
          {isUser ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
              <User className="h-4 w-4" />
            </div>
          ) : (
            <ButiLogo className="h-9 w-9" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {isUser ? "Tu" : "ButiGPT"}
          </div>

          {isUser ? (
            <div className="space-y-3">
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.images.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform hover:scale-[1.02]"
                    >
                      <img
                        src={src}
                        alt={`Imagine atașată ${i + 1}`}
                        className="max-h-64 max-w-xs object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {message.content}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {streaming && !message.content ? (
                <ThinkingIndicator />
              ) : (
                <div className={`buti-prose ${streaming ? "buti-caret" : ""}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content || "…"}
                  </ReactMarkdown>
                </div>
              )}
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {message.images.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-border bg-surface-2 shadow-soft transition-transform hover:scale-[1.01]"
                    >
                      <img
                        src={src}
                        alt={`Imagine generată ${i + 1}`}
                        className="max-h-96 max-w-md object-contain"
                      />
                    </a>
                  ))}
                </div>
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
