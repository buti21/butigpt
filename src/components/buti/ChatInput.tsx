import { useEffect, useRef, useState, KeyboardEvent, ClipboardEvent } from "react";
import { ArrowUp, Square, Paperclip, Camera, X, ImageIcon, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface AttachedImage {
  id: string;
  dataUrl: string; // base64 data URL
  name: string;
  size: number;
}

interface Props {
  onSend: (text: string, images: AttachedImage[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  externalImages?: AttachedImage[];
  onConsumeExternal?: () => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per image safeguard

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const uid = () => Math.random().toString(36).slice(2, 10);

export const ChatInput = ({ onSend, onStop, isStreaming, disabled, externalImages, onConsumeExternal }: Props) => {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [interimText, setInterimText] = useState("");
  const baseTextRef = useRef(""); // text in the box BEFORE we started listening this round
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported: micSupported, start: startMic, stop: stopMic } =
    useSpeechRecognition({
      lang: "ro-RO",
      onResult: (text, isFinal) => {
        if (isFinal) {
          // Append finalized chunk to base, then reset interim
          const sep = baseTextRef.current && !baseTextRef.current.endsWith(" ") ? " " : "";
          baseTextRef.current = (baseTextRef.current + sep + text).trimStart();
          setValue(baseTextRef.current);
          setInterimText("");
        } else {
          setInterimText(text);
        }
      },
    });

  const toggleMic = () => {
    if (!micSupported) {
      toast({
        title: "Dictarea nu e suportată",
        description: "Folosește Chrome/Edge pe desktop sau Safari pe iOS pentru această funcție.",
        variant: "destructive",
      });
      return;
    }
    if (isListening) {
      stopMic();
      setInterimText("");
    } else {
      // Snapshot what's currently in the textarea so finals get appended after it
      baseTextRef.current = value;
      setInterimText("");
      startMic();
    }
  };

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 240) + "px";
  }, [value]);

  useEffect(() => {
    if (externalImages && externalImages.length > 0) {
      setImages((prev) => [...prev, ...externalImages]);
      onConsumeExternal?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalImages]);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const additions: AttachedImage[] = [];
    for (const f of arr) {
      if (f.size > MAX_IMAGE_BYTES) continue;
      try {
        const dataUrl = await fileToDataUrl(f);
        additions.push({ id: uid(), dataUrl, name: f.name || "image", size: f.size });
      } catch {
        /* ignore */
      }
    }
    if (additions.length) setImages((prev) => [...prev, ...additions]);
  };

  const removeImage = (id: string) => setImages((p) => p.filter((i) => i.id !== id));

  const submit = () => {
    const text = value.trim();
    if ((!text && images.length === 0) || isStreaming || disabled) return;
    onSend(text, images);
    setValue("");
    setImages([]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      await addFiles(files);
    }
  };

  return (
    <div className="border-t border-border bg-background/60 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="rounded-2xl border border-border bg-surface-1 shadow-soft focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-[border,box-shadow] duration-200">
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-border px-3 pt-3 pb-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface-2"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                    aria-label="Elimină imaginea"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 p-2 pl-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 flex-shrink-0 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Atașează"
                  disabled={disabled}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-52">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Încarcă imagini
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="mr-2 h-4 w-4" />
                  Fă o poză
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              onPaste={onPaste}
              rows={1}
              placeholder="Scrie un mesaj sau lipește o imagine (Ctrl+V)…"
              className="max-h-[240px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled={disabled}
            />

            {isStreaming ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={onStop}
                className="h-9 w-9 flex-shrink-0 rounded-xl"
                aria-label="Oprește generarea"
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={submit}
                disabled={(!value.trim() && images.length === 0) || disabled}
                className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:bg-secondary disabled:bg-none"
                aria-label="Trimite"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ButiGPT poate face greșeli. Verifică informațiile importante.
        </p>
      </div>
    </div>
  );
};
