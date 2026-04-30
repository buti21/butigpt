import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, onStop, isStreaming, disabled }: Props) => {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text);
    setValue("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-background/60 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-surface-1 p-2 pl-4 shadow-soft focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-[border,box-shadow] duration-200">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder="Scrie un mesaj pentru ButiGPT…"
            className="max-h-[240px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={disabled}
          />

          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStop}
              className="h-9 w-9 rounded-xl"
              aria-label="Oprește generarea"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={!value.trim() || disabled}
              className="h-9 w-9 rounded-xl bg-gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:bg-secondary disabled:bg-none"
              aria-label="Trimite"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ButiGPT poate face greșeli. Verifică informațiile importante.
        </p>
      </div>
    </div>
  );
};
