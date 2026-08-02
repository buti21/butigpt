// Generare video prin Lovable AI (fără provider extern, fără chei suplimentare).
// Strategie: modelul de imagini Gemini (Nano Banana) generează keyframe-uri
// coerente între ele, iar aplicația le asamblează într-un clip real (WebM)
// cu interpolare/crossfade în browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Modele de imagine disponibile pe Lovable AI
const IMAGE_MODELS: Record<string, string> = {
  fast: "google/gemini-3.1-flash-image",
  quality: "google/gemini-3-pro-image",
  banana: "google/gemini-2.5-flash-image",
};

interface Body {
  prompt?: string;
  quality?: string;
  frames?: number;
}

async function shotList(prompt: string, count: number): Promise<string[]> {
  try {
    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content:
              `You are a cinematographer. Split the user's idea into exactly ${count} consecutive keyframes of ONE continuous shot (same subject, same style, same lighting, small progressive motion between frames). ` +
              `Reply ONLY with ${count} lines, no numbering, each line a detailed English image prompt (max 45 words) describing that moment, always ending with ", cinematic, photorealistic, 16:9".`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`shotlist ${resp.status}`);
    const data = await resp.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    const lines = text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter((l) => l.length > 10)
      .slice(0, count);
    if (lines.length >= 2) return lines;
    throw new Error("shotlist prea scurtă");
  } catch (e) {
    console.warn("shotlist fallback:", e);
    return Array.from({ length: count }, (_, i) =>
      `${prompt}, moment ${i + 1} of ${count} of one continuous camera move, cinematic, photorealistic, 16:9`,
    );
  }
}

async function genFrame(
  model: string,
  framePrompt: string,
  previous: string | null,
): Promise<string | null> {
  const content: unknown[] = [];
  if (previous) {
    content.push({ type: "image_url", image_url: { url: previous } });
    content.push({
      type: "text",
      text:
        `Continue this exact scene as the NEXT video frame. Keep the same subject, style, colors and lighting; change only motion slightly. New frame: ${framePrompt}`,
    });
  } else {
    content.push({ type: "text", text: framePrompt });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        console.error("frame error:", model, resp.status, t.slice(0, 200));
        if (resp.status === 402 || resp.status === 429) {
          throw Object.assign(new Error(t.slice(0, 200)), { status: resp.status });
        }
        continue;
      }
      const data = await resp.json();
      const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      if (url) return url;
    } catch (e) {
      if ((e as { status?: number }).status) throw e;
      console.error("frame exception:", e);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY nu este configurat" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt lipsă" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const qualityKey = body.quality && IMAGE_MODELS[body.quality] ? body.quality : "fast";
  const model = IMAGE_MODELS[qualityKey];
  const count = Math.max(2, Math.min(8, body.frames ?? (qualityKey === "quality" ? 6 : 4)));

  try {
    const prompts = await shotList(prompt, count);
    const frames: string[] = [];
    let previous: string | null = null;

    for (const p of prompts) {
      const url = await genFrame(model, p, previous);
      if (!url) continue;
      frames.push(url);
      previous = url;
    }

    if (frames.length < 2) {
      return new Response(
        JSON.stringify({ error: "Nu am putut genera suficiente cadre. Reîncearcă." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ frames, fps: 24, secondsPerFrame: 1.6, model, prompt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    const msg =
      status === 402
        ? "Creditul Lovable AI este epuizat. Adaugă credit în workspace pentru a genera video."
        : status === 429
          ? "Prea multe cereri. Așteaptă puțin și reîncearcă."
          : e instanceof Error
            ? e.message
            : "eroare";
    console.error("video gen failed:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: status === 402 ? 402 : status === 429 ? 429 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
