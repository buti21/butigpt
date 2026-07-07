export interface TtsVoice {
  id: string;
  label: string;
  gender: "female" | "male";
  description: string;
}

// Voci publice ElevenLabs, compatibile eleven_multilingual_v2 (inclusiv română)
export const TTS_VOICES: TtsVoice[] = [
  // FEMEI
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", gender: "female", description: "Naturală, clară (implicit)" },
  { id: "9BWtsMINqrJLrRacOk9x", label: "Aria", gender: "female", description: "Caldă, expresivă" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", gender: "female", description: "Prietenoasă, tânără" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", gender: "female", description: "Blândă, matură" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", gender: "female", description: "Britanică, profesionistă" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", gender: "female", description: "Dulce, calmă" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", gender: "female", description: "Vibrantă, tânără" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", gender: "female", description: "Caldă, narativă" },
  // BĂRBAȚI
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", gender: "male", description: "Autoritar, matur" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger", gender: "male", description: "Grav, sigur" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie", gender: "male", description: "Tânăr, casual" },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", gender: "male", description: "Intens, dramatic" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", gender: "male", description: "Articulat, clar" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian", gender: "male", description: "Profund, narativ" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris", gender: "male", description: "Prietenos, natural" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", gender: "male", description: "Britanic, formal" },
];

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const getVoiceById = (id: string) =>
  TTS_VOICES.find((v) => v.id === id) ?? TTS_VOICES[0];
