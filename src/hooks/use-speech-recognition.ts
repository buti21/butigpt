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

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (final) onResultRef.current?.(final, true);
      else if (interim) onResultRef.current?.(interim, false);
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
