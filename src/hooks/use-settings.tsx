import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ColorTheme = "violet" | "ocean" | "sunset" | "mono" | "forest";
export type TypewriterSpeed = "slow" | "normal" | "fast" | "instant";
export type ModelChoice = "fast" | "smart" | "lite";
export type ResponseLanguage = "auto" | "ro" | "en" | "fr" | "es" | "de" | "it";
export type ResponseTone = "default" | "casual" | "formal" | "concise" | "playful" | "expert";

interface Settings {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  typewriterSpeed: TypewriterSpeed;
  autoTts: boolean;
  ttsSpeed: number; // 0.75..1.5
  ttsVoiceId: string;
  enterToSend: boolean;
  model: ModelChoice;
  saveHistory: boolean;
  improveModel: boolean;
  language: ResponseLanguage;
  tone: ResponseTone;
  customInstructions: string;
  aboutYou: string;
  followUps: boolean;
  compactMode: boolean;
  showTimestamps: boolean;
}

interface SettingsCtx extends Settings {
  setTheme: (t: ThemeMode) => void;
  setColorTheme: (t: ColorTheme) => void;
  setTypewriterSpeed: (s: TypewriterSpeed) => void;
  setAutoTts: (v: boolean) => void;
  setTtsSpeed: (v: number) => void;
  setTtsVoiceId: (v: string) => void;
  setEnterToSend: (v: boolean) => void;
  setModel: (m: ModelChoice) => void;
  setSaveHistory: (v: boolean) => void;
  setImproveModel: (v: boolean) => void;
  setLanguage: (l: ResponseLanguage) => void;
  setTone: (t: ResponseTone) => void;
  setCustomInstructions: (v: string) => void;
  setAboutYou: (v: string) => void;
  setFollowUps: (v: boolean) => void;
  setCompactMode: (v: boolean) => void;
  setShowTimestamps: (v: boolean) => void;
}

const KEY = "butigpt:settings:v1";

const DEFAULTS: Settings = {
  theme: "dark",
  colorTheme: "violet",
  typewriterSpeed: "normal",
  autoTts: false,
  ttsSpeed: 1,
  ttsVoiceId: "EXAVITQu4vr4xnSDxMaL",
  enterToSend: true,
  model: "fast",
  saveHistory: true,
  improveModel: false,
  language: "auto",
  tone: "default",
  customInstructions: "",
  aboutYou: "",
  followUps: false,
  compactMode: false,
  showTimestamps: false,
};

const Ctx = createContext<SettingsCtx | null>(null);

const THEME_CLASSES: ColorTheme[] = ["violet", "ocean", "sunset", "mono", "forest"];

const applyTheme = (theme: ThemeMode, color: ColorTheme) => {
  const root = document.documentElement;
  const isLight =
    theme === "light" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: light)").matches);
  root.classList.toggle("light", isLight);
  THEME_CLASSES.forEach((c) => root.classList.remove(`theme-${c}`));
  root.classList.add(`theme-${color}`);
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
    applyTheme(settings.theme, settings.colorTheme);
  }, [settings]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("system", settings.colorTheme);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [settings.theme, settings.colorTheme]);

  const update = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <Ctx.Provider
      value={{
        ...settings,
        setTheme: (theme) => update({ theme }),
        setColorTheme: (colorTheme) => update({ colorTheme }),
        setTypewriterSpeed: (typewriterSpeed) => update({ typewriterSpeed }),
        setAutoTts: (autoTts) => update({ autoTts }),
        setTtsSpeed: (ttsSpeed) => update({ ttsSpeed }),
        setTtsVoiceId: (ttsVoiceId) => update({ ttsVoiceId }),
        setEnterToSend: (enterToSend) => update({ enterToSend }),
        setModel: (model) => update({ model }),
        setSaveHistory: (saveHistory) => update({ saveHistory }),
        setImproveModel: (improveModel) => update({ improveModel }),
        setLanguage: (language) => update({ language }),
        setTone: (tone) => update({ tone }),
        setCustomInstructions: (customInstructions) => update({ customInstructions }),
        setAboutYou: (aboutYou) => update({ aboutYou }),
        setFollowUps: (followUps) => update({ followUps }),
        setCompactMode: (compactMode) => update({ compactMode }),
        setShowTimestamps: (showTimestamps) => update({ showTimestamps }),
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
