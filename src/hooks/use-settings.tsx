import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type TypewriterSpeed = "slow" | "normal" | "fast" | "instant";

interface Settings {
  theme: ThemeMode;
  typewriterSpeed: TypewriterSpeed;
  autoTts: boolean;
  enterToSend: boolean;
}

interface SettingsCtx extends Settings {
  setTheme: (t: ThemeMode) => void;
  setTypewriterSpeed: (s: TypewriterSpeed) => void;
  setAutoTts: (v: boolean) => void;
  setEnterToSend: (v: boolean) => void;
}

const KEY = "butigpt:settings:v1";

const DEFAULTS: Settings = {
  theme: "dark",
  typewriterSpeed: "normal",
  autoTts: false,
  enterToSend: true,
};

const Ctx = createContext<SettingsCtx | null>(null);

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  const isLight =
    theme === "light" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: light)").matches);
  root.classList.toggle("light", isLight);
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULTS;
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    applyTheme(settings.theme);
  }, [settings]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("system");
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [settings.theme]);

  const update = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <Ctx.Provider
      value={{
        ...settings,
        setTheme: (theme) => update({ theme }),
        setTypewriterSpeed: (typewriterSpeed) => update({ typewriterSpeed }),
        setAutoTts: (autoTts) => update({ autoTts }),
        setEnterToSend: (enterToSend) => update({ enterToSend }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
};
