import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ButiLogo } from "./ButiLogo";
import { User } from "lucide-react";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
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
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {message.content}
            </div>
          ) : (
            <div className={`buti-prose ${streaming ? "buti-caret" : ""}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || (streaming ? "" : "…")}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
