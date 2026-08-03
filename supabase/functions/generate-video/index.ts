// Generare video REALĂ (text→video, mișcare adevărată) prin Hugging Face
// Inference Providers (routerul HF, folosind HF_TOKEN existent).
// Dacă niciun provider video nu răspunde (credit HF epuizat etc.), cădem
// elegant pe vechea strategie cu keyframe-uri Gemini asamblate în browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const HF_TOKEN = Deno.env.get("HF_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const HF_ROUTER = "https://router.huggingface.co";

const IMAGE_MODELS: Record<string, string> = {
  fast: "google/gemini-3.1-flash-image",
  quality: "google/gemini-3-pro-image",
  banana: "google/gemini-2.5-flash-image",
};

// Modele text→video reale, în ordinea de încercare.
interface VideoModel {
  label: string;
  path: string;
  body: (prompt: string) => unknown;
}

const FAST_VIDEO: VideoModel[] = [
  {
    label: "LTX-Video 0.9.8 13B distilled (fal)",
    path: "/fal-ai/fal-ai/ltx-video-13b-distilled",
    body: (prompt) => ({ prompt, aspect_ratio: "16:9" }),
  },
  {
    label: "Wan 2.2 5B (fal)",
    path: "/fal-ai/fal-ai/wan/v2.2-5b/text-to-video",
    body: (prompt) => ({ prompt, resolution: "580p", aspect_ratio: "16:9" }),
  },
  {
    label: "Wan 2.2 5B fast (replicate)",
    path: "/replicate/v1/models/wan-video/wan-2.2-5b-fast/predictions",
    body: (prompt) => ({ input: { prompt } }),
  },
];

const QUALITY_VIDEO: VideoModel[] = [
  {
    label: "Wan 2.2 A14B (fal)",
    path: "/fal-ai/fal-ai/wan/v2.2-a14b/text-to-video",
    body: (prompt) => ({ prompt, resolution: "720p", aspect_ratio: "16:9" }),
  },
  ...FAST_VIDEO,
];

// --- Tier 1: generare video REALĂ gratuită (LTX-Video pe ZeroGPU) ---
const SPACE = "https://Lightricks-ltx-video-distilled.hf.space/gradio_api";
const NEG = "worst quality, inconsistent motion, blurry, jittery, distorted";

async function freeRealVideo(
  prompt: string,
  quality: string,
): Promise<{ url: string; label: string } | null> {
  const hq = quality === "quality";
  const duration = hq ? 5 : 3;
  const h = hq ? 640 : 512;
  const w = hq ? 896 : 704;

  try {
    const start = await fetch(`${SPACE}/call/text_to_video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          prompt,
          NEG,
          null,
          null,
          h,
          w,
          "text-to-video",
          duration,
          9,
          Math.floor(Math.random() * 1_000_000),
          true,
          1,
          true,
        ],
      }),
    });
    if (!start.ok) {
      console.error("space start failed", start.status, (await start.text()).slice(0, 200));
      return null;
    }
    const { event_id } = await start.json();
    if (!event_id) return null;

    const stream = await fetch(`${SPACE}/call/text_to_video/${event_id}`);
    if (!stream.ok || !stream.body) {
      console.error("space stream failed", stream.status);
      return null;
    }
    const reader = stream.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let videoUrl: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event: error")) {
          console.error("space event error");
          return null;
        }
        if (!line.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          const u = findVideoUrl(payload);
          if (u) videoUrl = u;
        } catch {
          /* heartbeat */
        }
      }
      if (videoUrl) break;
    }
    reader.cancel().catch(() => {});
    if (!videoUrl) return null;

    console.log("free real video ready:", videoUrl);
    const mirrored = await mirror(videoUrl);
    return { url: mirrored ?? videoUrl, label: "LTX-Video (real motion)" };
  } catch (e) {
    console.error("free video exception", e);
    return null;
  }
}

const hfHeaders = () => ({
  Authorization: `Bearer ${HF_TOKEN}`,
  "Content-Type": "application/json",
});


function findVideoUrl(obj: unknown, depth = 0): string | null {
  if (depth > 6 || obj == null) return null;
  if (typeof obj === "string") {
    return /^https?:\/\/\S+\.(mp4|webm|mov)(\?|$)/i.test(obj) ? obj : null;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const u = findVideoUrl(it, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = findVideoUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

async function pollUrl(url: string, deadline: number): Promise<string | null> {
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(url, { headers: hfHeaders() });
    const ct = r.headers.get("content-type") ?? "";
    if (!r.ok) {
      console.error("poll failed", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    if (!ct.includes("json")) return null;
    const j = await r.json();
    const status = (j.status ?? j.state ?? "").toString().toUpperCase();
    if (status === "FAILED" || status === "CANCELED" || status === "ERROR") {
      console.error("job failed", JSON.stringify(j).slice(0, 300));
      return null;
    }
    const direct = findVideoUrl(j);
    if (direct) return direct;
    if (status === "COMPLETED" || status === "SUCCEEDED") {
      // rezultatul poate fi la response_url
      const rurl = j.response_url ?? j.urls?.get;
      if (rurl && rurl !== url) {
        const rr = await fetch(rurl, { headers: hfHeaders() });
        if (rr.ok) {
          const u = findVideoUrl(await rr.json());
          if (u) return u;
        }
      }
      return null;
    }
  }
  return null;
}

async function tryRealVideo(prompt: string, models: VideoModel[]): Promise<{ url: string; label: string } | null> {
  if (!HF_TOKEN) return null;
  const deadline = Date.now() + 220_000;

  for (const m of models) {
    if (Date.now() > deadline - 20_000) break;
    try {
      const resp = await fetch(`${HF_ROUTER}${m.path}`, {
        method: "POST",
        headers: hfHeaders(),
        body: JSON.stringify(m.body(prompt)),
      });
      const ct = resp.headers.get("content-type") ?? "";

      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        console.error("video model rejected:", m.label, resp.status, t.slice(0, 200));
        continue;
      }

      if (ct.startsWith("video/") || ct.includes("octet-stream")) {
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const stored = await store(bytes, "video/mp4");
        if (stored) return { url: stored, label: m.label };
        continue;
      }

      const json = await resp.json();
      let url = findVideoUrl(json);
      if (!url) {
        const statusUrl = json.status_url ?? json.urls?.get ?? json.response_url;
        if (statusUrl) url = await pollUrl(statusUrl, deadline);
      }
      if (url) {
        console.log("real video ready via", m.label);
        const mirrored = await mirror(url);
        return { url: mirrored ?? url, label: m.label };
      }
      console.error("no video in response:", m.label, JSON.stringify(json).slice(0, 300));
    } catch (e) {
      console.error("video model exception:", m.label, e);
    }
  }
  return null;
}

async function store(bytes: Uint8Array, contentType: string): Promise<string | null> {
  try {
    const path = `gen/${crypto.randomUUID()}.mp4`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/videos/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": contentType,
      },
      body: bytes,
    });
    if (!up.ok) {
      console.error("upload failed", up.status, (await up.text()).slice(0, 200));
      return null;
    }
    const signed = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/videos/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 }),
    });
    if (!signed.ok) return null;
    const { signedURL } = await signed.json();
    return `${SUPABASE_URL}/storage/v1${signedURL}`;
  } catch (e) {
    console.error("store exception", e);
    return null;
  }
}

async function mirror(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await store(new Uint8Array(await r.arrayBuffer()), r.headers.get("content-type") ?? "video/mp4");
  } catch (e) {
    console.error("mirror exception", e);
    return null;
  }
}

/* ---------- fallback: keyframe-uri (vechea strategie) ---------- */

async function shotList(prompt: string, count: number): Promise<string[]> {
  try {
    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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

async function genFrame(model: string, framePrompt: string, previous: string | null): Promise<string | null> {
  const content: unknown[] = [];
  if (previous) {
    content.push({ type: "image_url", image_url: { url: previous } });
    content.push({
      type: "text",
      text: `Continue this exact scene as the NEXT video frame. Keep the same subject, style, colors and lighting; change only motion slightly. New frame: ${framePrompt}`,
    });
  } else {
    content.push({ type: "text", text: framePrompt });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
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

interface Body {
  prompt?: string;
  quality?: string;
  frames?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

  // 1) încearcă video real (mișcare adevărată)
  const real = await tryRealVideo(prompt, qualityKey === "quality" ? QUALITY_VIDEO : FAST_VIDEO);
  if (real) {
    return new Response(JSON.stringify({ videoUrl: real.url, model: real.label, prompt, kind: "real" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) fallback: keyframe-uri asamblate în browser
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Niciun provider video disponibil" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
      return new Response(JSON.stringify({ error: "Nu am putut genera video. Reîncearcă." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ frames, fps: 24, secondsPerFrame: 1.6, model, prompt, kind: "frames" }),
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
