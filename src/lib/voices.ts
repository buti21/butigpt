export interface TtsVoice {
  id: string;
  label: string;
  gender: "female" | "male";
  description: string;
}

// Voci OpenAI TTS (prin Lovable AI) – calitate mult mai bună, suportă româna
export const TTS_VOICES: TtsVoice[] = [
  // FEMEI
  { id: "nova", label: "Nova", gender: "female", description: "Naturală, clară (implicit)" },
  { id: "shimmer", label: "Shimmer", gender: "female", description: "Luminoasă, prietenoasă" },
  { id: "coral", label: "Coral", gender: "female", description: "Caldă, expresivă" },
  { id: "sage", label: "Sage", gender: "female", description: "Calmă, echilibrată" },
  { id: "alloy", label: "Alloy", gender: "female", description: "Neutră, profesionistă" },
  // BĂRBAȚI
  { id: "onyx", label: "Onyx", gender: "male", description: "Grav, autoritar" },
  { id: "echo", label: "Echo", gender: "male", description: "Clar, articulat" },
  { id: "ash", label: "Ash", gender: "male", description: "Relaxat, natural" },
  { id: "ballad", label: "Ballad", gender: "male", description: "Cald, narativ" },
  { id: "fable", label: "Fable", gender: "male", description: "Britanic, povestitor" },
  { id: "verse", label: "Verse", gender: "male", description: "Dinamic, conversațional" },
];

export const DEFAULT_VOICE_ID = "nova";

export const getVoiceById = (id: string) =>
  TTS_VOICES.find((v) => v.id === id) ?? TTS_VOICES[0];
