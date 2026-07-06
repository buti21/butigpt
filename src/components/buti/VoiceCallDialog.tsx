import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ButiLogo } from "./ButiLogo";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type CallState = "idle" | "listening" | "thinking" | "speaking";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const VoiceCallDialog = ({ open, onOpenChange }: Props) => {
  const s = useSettings();
  const [state, setState] = useState<CallState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [muted, setMuted] = useState(false);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const finalBufferRef = useRef("");

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const askAndSpeak = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;
      setState("thinking");
      setReply("");
      historyRef.current.push({ role: "user", content: userText });

      const systemExtras =
        `Ești în modul APEL VOCAL. Răspunde SCURT (1-3 propoziții), natural și conversațional, ca într-un apel telefonic. Fără liste, fără markdown, fără cod. ` +
        (s.aboutYou ? `Despre utilizator: ${s.aboutYou}. ` : "") +
        (s.customInstructions ? `Preferințe: ${s.customInstructions}` : "");

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON}`,
          },
          body: JSON.stringify({
            messages: historyRef.current,
            model: s.model,
            systemExtras,
          }),
        });
        if (!resp.ok || !resp.body) throw new Error("chat failed");

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const p = JSON.parse(payload);
              const c = p.choices?.[0]?.delta?.content;
              if (c) {
                full += c;
                setReply(full);
              }
            } catch {
              /* ignore */
            }
          }
        }

        const cleanText = full.replace(/[*_`#>\[\]()]/g, "").trim();
        if (!cleanText) {
          setState("listening");
          return;
        }
        historyRef.current.push({ role: "assistant", content: cleanText });

        setState("speaking");
        const ttsResp = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ text: cleanText.slice(0, 800) }),
        });
        const data = await ttsResp.json();
        if (!data?.audioContent) throw new Error("no audio");
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        try { audio.playbackRate = Math.max(0.5, Math.min(2, s.ttsSpeed || 1)); } catch {}
        audioRef.current = audio;
        audio.onended = () => {
          audioRef.current = null;
          setState("listening");
        };
        audio.onerror = () => {
          audioRef.current = null;
          setState("listening");
        };
        await audio.play();
      } catch (e) {
        console.error(e);
        toast({ title: "Eroare apel", description: "Nu am putut răspunde.", variant: "destructive" });
        setState("listening");
      }
    },
    [s.model, s.aboutYou, s.customInstructions, s.ttsSpeed],
  );

  const { isListening, isSupported, start, stop } = useSpeechRecognition({
    lang: s.language === "en" ? "en-US" : s.language === "fr" ? "fr-FR" : s.language === "es" ? "es-ES" : s.language === "de" ? "de-DE" : s.language === "it" ? "it-IT" : "ro-RO",
    onResult: (text, isFinal) => {
      if (!text) return;
      if (isFinal) {
        finalBufferRef.current += (finalBufferRef.current ? " " : "") + text;
        setTranscript(finalBufferRef.current);
        // debounce -> after 1s of silence submit
        if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = window.setTimeout(() => {
          const t = finalBufferRef.current.trim();
          finalBufferRef.current = "";
          setTranscript("");
          if (t) askAndSpeak(t);
        }, 900);
      } else {
        setTranscript(finalBufferRef.current + (finalBufferRef.current ? " " : "") + text);
      }
    },
  });

  // Auto-listen when speaking finishes and we're back to listening
  useEffect(() => {
    if (!open) return;
    if (muted) { stop(); return; }
    if (state === "listening" && !isListening) {
      start();
    }
    if (state === "speaking" || state === "thinking") {
      if (isListening) stop();
    }
  }, [state, open, muted, isListening, start, stop]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      historyRef.current = [];
      setTranscript("");
      setReply("");
      setMuted(false);
      setState("listening");
    } else {
      stop();
      stopAudio();
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      setState("idle");
    }
  }, [open, stop, stopAudio]);

  const endCall = () => {
    stop();
    stopAudio();
    onOpenChange(false);
  };

  const label =
    state === "listening" ? "Ascult…" :
    state === "thinking" ? "Se gândește…" :
    state === "speaking" ? "Vorbește…" : "Pregătit";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : endCall())}>
      <DialogContent className="border-border bg-surface-1 p-0 gap-0 w-screen h-[100dvh] max-w-none rounded-none translate-x-0 translate-y-0 top-0 left-0 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:h-auto sm:rounded-2xl sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] flex flex-col">
        <DialogTitle className="sr-only">Apel vocal cu ButiGPT</DialogTitle>
        <DialogDescription className="sr-only">Vorbește cu ButiGPT ca într-un apel telefonic</DialogDescription>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 min-h-0">
          <div className={cn(
            "relative flex items-center justify-center rounded-full transition-all duration-500",
            "h-40 w-40 sm:h-48 sm:w-48 bg-gradient-primary shadow-glow",
            (state === "listening" || state === "speaking") && "animate-pulse"
          )}>
            <div className={cn(
              "absolute inset-0 rounded-full bg-primary/30 blur-2xl",
              state === "speaking" && "animate-ping"
            )} />
            <ButiLogo className="h-20 w-20 sm:h-24 sm:w-24 relative z-10" />
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold">ButiGPT</div>
          </div>

          <div className="w-full max-w-sm min-h-[80px] rounded-xl border border-border bg-surface-2 p-3 text-sm">
            {state === "thinking" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Se gândește…
              </div>
            )}
            {state === "speaking" && (
              <div className="flex items-start gap-2">
                <Volume2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <p className="leading-relaxed">{reply || "…"}</p>
              </div>
            )}
            {state === "listening" && (
              <div className="text-muted-foreground italic">
                {transcript || "Spune ceva…"}
              </div>
            )}
            {!isSupported && state === "listening" && (
              <div className="text-xs text-destructive mt-2">
                Browserul tău nu suportă recunoașterea vocală. Încearcă Chrome pe desktop sau Safari pe iOS.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 px-6 py-6 border-t border-border bg-surface-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMuted((m) => !m)}
            className={cn("h-14 w-14 rounded-full", muted && "bg-destructive/20 border-destructive text-destructive")}
            aria-label={muted ? "Reactivează microfonul" : "Oprește microfonul"}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          <Button
            onClick={endCall}
            className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-glow"
            aria-label="Închide apelul"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
