import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ButiLogo } from "./ButiLogo";
import { User } from "lucide-react";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  images?: string[]; // attached images (user) or generated images (assistant)
}

interface Props {
  message: ChatMessage;
  streaming?: boolean;
}

export const MessageBubble = ({ message, streaming }: Props) => {
  const isUser = message.role === "user";

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
              <div className={`buti-prose ${streaming ? "buti-caret" : ""}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content || (streaming ? "" : "…")}
                </ReactMarkdown>
              </div>
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
        </div>
      </div>
    </div>
  );
};
