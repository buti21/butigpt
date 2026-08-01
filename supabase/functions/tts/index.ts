import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SPEECH_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";

const VALID_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse",
]);
const DEFAULT_VOICE = "nova";

// Strip markdown so TTS doesn't read "asterisk" / "hash" out loud
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (bloc de cod) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Split long text into chunks that stay well under the model input limit
function chunkForTTS(text: string, maxWords = 350): string[] {
  const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (wordCount(sentence) > maxWords) {
      flush();
      const words = sentence.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(" "));
      }
      continue;
    }
    if (current && wordCount(current) + wordCount(sentence) > maxWords) flush();
    current += sentence;
  }
  flush();
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY nu este configurat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text lipsă" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = stripMarkdown(text).slice(0, 6000);
    if (!cleaned) {
      return new Response(JSON.stringify({ error: "Nimic de citit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voice =
      typeof voiceId === "string" && VALID_VOICES.has(voiceId) ? voiceId : DEFAULT_VOICE;

    const chunks = chunkForTTS(cleaned);
    const parts: Uint8Array[] = [];

    for (const chunk of chunks) {
      const resp = await fetch(SPEECH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: chunk,
          voice,
          response_format: "mp3",
          instructions:
            "Vorbește în română cu pronunție corectă, clară și naturală. Rostește fiecare cuvânt complet, cu ritm calm și intonație prietenoasă.",
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("TTS gateway error:", resp.status, errText);
        const status = resp.status === 402 || resp.status === 429 ? resp.status : 500;
        return new Response(
          JSON.stringify({ error: `TTS error: ${resp.status}`, details: errText.slice(0, 300) }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      parts.push(new Uint8Array(await resp.arrayBuffer()));
    }

    const total = parts.reduce((n, p) => n + p.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.length;
    }

    return new Response(JSON.stringify({ audioContent: base64Encode(merged) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
