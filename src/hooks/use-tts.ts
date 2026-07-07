import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/hooks/use-settings";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Global registry so only ONE message can be playing at a time across the app.
let currentAudio: HTMLAudioElement | null = null;
let currentSetter: ((v: boolean) => void) | null = null;

export function useTTS() {
  const { ttsSpeed, ttsVoiceId } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
    }
    audioRef.current = null;
    if (currentAudio === a) {
      currentAudio = null;
      currentSetter = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    async (text: string) => {
      if (isPlaying || isLoading) {
        stop();
        return;
      }

      // Stop any other instance currently playing
      if (currentAudio) {
        try {
          currentAudio.pause();
        } catch {
          /* ignore */
        }
        currentSetter?.(false);
        currentAudio = null;
        currentSetter = null;
      }

      setIsLoading(true);
      try {
        const resp = await fetch(TTS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ text }),
        });
        if (!resp.ok) {
          throw new Error(`TTS failed: ${resp.status}`);
        }
        const data = await resp.json();
        if (!data?.audioContent) throw new Error("No audio");

        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        try {
          audio.playbackRate = Math.max(0.5, Math.min(2, ttsSpeed || 1));
        } catch { /* ignore */ }
        audioRef.current = audio;
        currentAudio = audio;
        currentSetter = setIsPlaying;

        audio.onended = () => {
          if (currentAudio === audio) {
            currentAudio = null;
            currentSetter = null;
          }
          setIsPlaying(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          if (currentAudio === audio) {
            currentAudio = null;
            currentSetter = null;
          }
          setIsPlaying(false);
          audioRef.current = null;
        };

        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error("TTS error:", e);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isPlaying, stop, ttsSpeed],
  );

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        if (currentAudio === a) {
          currentAudio = null;
          currentSetter = null;
        }
      }
    };
  }, []);

  return { isLoading, isPlaying, play, stop };
}
