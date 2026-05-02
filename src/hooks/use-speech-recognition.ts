import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type for the browser SpeechRecognition API
type SpeechRecognitionLike = any;

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (text: string, isFinal: boolean) => void;
}

export function useSpeechRecognition(opts: UseSpeechRecognitionOptions = {}) {
  const { lang = "ro-RO", onResult } = opts;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  // Track which final results we've already delivered to the caller, so the
  // browser re-emitting the same final result (common on Chrome) doesn't cause
  // duplicate words.
  const processedFinalIndexRef = useRef(0);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    // Reset for a fresh session
    processedFinalIndexRef.current = 0;

    rec.onresult = (event: any) => {
      let interim = "";
      let newFinal = "";

      // Walk through ALL results; only emit finals whose index we haven't
      // processed yet. Interim text is always rebuilt from scratch (current
      // un-finalized portion).
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript: string = res[0]?.transcript ?? "";
        if (res.isFinal) {
          if (i >= processedFinalIndexRef.current) {
            newFinal += transcript;
            processedFinalIndexRef.current = i + 1;
          }
        } else {
          interim += transcript;
        }
      }

      if (newFinal) onResultRef.current?.(newFinal, true);
      // Always update interim (may be empty when nothing pending)
      onResultRef.current?.(interim, false);
    };

    rec.onerror = () => {
      setIsListening(false);
    };
    rec.onend = () => {
      setIsListening(false);
    };

    recRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { isListening, isSupported, start, stop };
}
