import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, Stethoscope, Mic } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

const STT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = "idle" | "run" | "ok" | "fail";
interface Step {
  key: string;
  label: string;
  status: Status;
  detail?: string;
}

const INITIAL: Step[] = [
  { key: "mic", label: "Microfon (permisiune + nivel)", status: "idle" },
  { key: "stt", label: "Transcriere (voce → text)", status: "idle" },
  { key: "tts", label: "Sinteză vocală (text → voce)", status: "idle" },
];

export const AudioSelfTest = () => {
  const s = useSettings();
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const { level, recordOnce } = useVoiceRecorder();

  const set = (key: string, status: Status, detail?: string) =>
    setSteps((prev) => prev.map((st) => (st.key === key ? { ...st, status, detail } : st)));

  const run = useCallback(async () => {
    setRunning(true);
    setSteps(INITIAL.map((st) => ({ ...st, status: "idle", detail: undefined })));

    // 1. Microfon — 4 secunde de înregistrare
    set("mic", "run");
    setPhase("Vorbește acum: „Salut, sunt eu, testul audio ButiGPT.”");
    const wav = await recordOnce(4000);
    setPhase("");
    if (!wav) {
      set("mic", "fail", "Fără permisiune sau microfon mut. Verifică setările browserului.");
      setRunning(false);
      return;
    }
    set("mic", "ok", `Audio capturat: ${(wav.size / 1024).toFixed(0)} KB`);

    // 2. Transcriere
    set("stt", "run");
    let text = "";
    try {
      const fd = new FormData();
      fd.append("file", wav, "recording.wav");
      fd.append("language", s.language === "auto" ? "" : s.language);
      const resp = await fetch(STT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}` },
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      text = (data?.text ?? "").trim();
      if (!text) throw new Error("Nu s-a detectat vorbire în înregistrare.");
      set("stt", "ok", `„${text}”`);
    } catch (e) {
      set("stt", "fail", e instanceof Error ? e.message : "eroare");
      setRunning(false);
      return;
    }

    // 3. Sinteză vocală — redă ce a înțeles
    set("tts", "run");
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({
          text: `Test reușit. Am înțeles: ${text}`,
          voiceId: s.ttsVoiceId,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.audioContent) throw new Error(data?.error || `HTTP ${resp.status}`);
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
      audio.playbackRate = Math.max(0.5, Math.min(2, s.ttsSpeed || 1));
      await audio.play();
      set("tts", "ok", "Ascultă redarea — dacă auzi vocea, totul funcționează.");
    } catch (e) {
      set("tts", "fail", e instanceof Error ? e.message : "eroare");
    }
    setRunning(false);
  }, [recordOnce, s.language, s.ttsSpeed, s.ttsVoiceId]);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Stethoscope className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Self-test audio</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verifică microfonul, transcrierea și vocea, pas cu pas.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={running} className="gap-1.5 flex-shrink-0">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          {running ? "Se testează…" : "Pornește"}
        </Button>
      </div>

      {phase && (
        <div className="space-y-1.5">
          <p className="text-xs text-primary">{phase}</p>
          <Progress value={Math.min(100, level * 900)} className="h-1.5" />
        </div>
      )}

      <ul className="space-y-2">
        {steps.map((st) => (
          <li key={st.key} className="flex items-start gap-2 text-xs">
            {st.status === "ok" && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
            {st.status === "fail" && <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
            {st.status === "run" && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
            {st.status === "idle" && (
              <span className="h-4 w-4 flex-shrink-0 rounded-full border border-border" />
            )}
            <div className="min-w-0">
              <div className={cn(st.status === "fail" && "text-destructive")}>{st.label}</div>
              {st.detail && <div className="text-muted-foreground break-words">{st.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
