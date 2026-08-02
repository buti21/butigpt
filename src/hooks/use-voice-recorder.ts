import { useCallback, useEffect, useRef, useState } from "react";
import { encodeWav, rms } from "@/lib/audio-utils";

interface Options {
  /** Se apelează cu fiecare frază completă (după pauză de vorbire) */
  onUtterance?: (wav: Blob) => void;
  /** Nivel de zgomot sub care considerăm liniște */
  silenceThreshold?: number;
  /** Milisecunde de liniște care închide o frază */
  silenceMs?: number;
  /** Durata minimă a unei fraze (ms) ca să fie trimisă */
  minSpeechMs?: number;
}

/**
 * Înregistrare cu Web Audio + detecție de voce (VAD simplu pe RMS).
 * Produce fișiere WAV complete, decodabile pe orice browser — spre deosebire
 * de fragmentele MediaRecorder care nu au header.
 */
export function useVoiceRecorder(opts: Options = {}) {
  const {
    onUtterance,
    silenceThreshold = 0.012,
    silenceMs = 900,
    minSpeechMs = 350,
  } = opts;

  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const speakingRef = useRef(false);
  const speechStartRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const pausedRef = useRef(false);
  const cbRef = useRef(onUtterance);

  useEffect(() => {
    cbRef.current = onUtterance;
  }, [onUtterance]);

  const teardown = useCallback(() => {
    try { nodeRef.current?.disconnect(); } catch { /* ignore */ }
    try { srcRef.current?.disconnect(); } catch { /* ignore */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { ctxRef.current?.close(); } catch { /* ignore */ }
    nodeRef.current = null;
    srcRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    chunksRef.current = [];
    speakingRef.current = false;
    setLevel(0);
    setIsRecording(false);
  }, []);

  const flush = useCallback(() => {
    const chunks = chunksRef.current;
    chunksRef.current = [];
    speakingRef.current = false;
    const ctx = ctxRef.current;
    if (!ctx || chunks.length === 0) return;
    const wav = encodeWav(chunks, ctx.sampleRate);
    if (wav.size < 4000) return; // prea scurt / gol
    cbRef.current?.(wav);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (ctxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      srcRef.current = src;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;

      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const energy = rms(input);
        setLevel(energy);
        if (pausedRef.current) return;

        const now = Date.now();
        if (energy > silenceThreshold) {
          if (!speakingRef.current) {
            speakingRef.current = true;
            speechStartRef.current = now;
            chunksRef.current = [];
          }
          lastVoiceRef.current = now;
          chunksRef.current.push(new Float32Array(input));
        } else if (speakingRef.current) {
          // păstrăm puțină liniște ca „tail” natural
          chunksRef.current.push(new Float32Array(input));
          if (now - lastVoiceRef.current > silenceMs) {
            const spoken = lastVoiceRef.current - speechStartRef.current;
            if (spoken >= minSpeechMs) {
              flush();
            } else {
              chunksRef.current = [];
              speakingRef.current = false;
            }
          }
        }
      };

      src.connect(node);
      node.connect(ctx.destination);
      setIsRecording(true);
    } catch (e) {
      console.error("mic error:", e);
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Accesul la microfon a fost refuzat."
          : "Nu am putut porni microfonul.",
      );
      teardown();
    }
  }, [flush, minSpeechMs, silenceMs, silenceThreshold, teardown]);

  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  /** Pauzează procesarea (ex: cât timp vorbește asistentul) fără a închide microfonul */
  const setPaused = useCallback((v: boolean) => {
    pausedRef.current = v;
    if (v) {
      chunksRef.current = [];
      speakingRef.current = false;
    }
  }, []);

  /** Înregistrează o singură bucată de durată fixă (pentru self-test) */
  const recordOnce = useCallback(async (ms: number): Promise<Blob | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      let peak = 0;
      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        peak = Math.max(peak, rms(input));
        setLevel(rms(input));
        chunks.push(new Float32Array(input));
      };
      src.connect(node);
      node.connect(ctx.destination);
      await new Promise((r) => setTimeout(r, ms));
      node.disconnect();
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const wav = encodeWav(chunks, ctx.sampleRate);
      await ctx.close();
      setLevel(0);
      if (peak < 0.005) return null; // microfon mut
      return wav;
    } catch (e) {
      console.error("recordOnce error:", e);
      return null;
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return { isRecording, level, error, start, stop, setPaused, recordOnce, flush };
}
