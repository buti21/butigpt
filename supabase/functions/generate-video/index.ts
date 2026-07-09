// Generează un videoclip scurt prin Fal.ai (LTX Video / Kling)
// Rulează pe Deno (Supabase Edge Functions).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FAL_KEY = Deno.env.get("FAL_KEY");

// Modele Fal disponibile (rapide + calitate ok, tier gratuit)
const MODEL_ENDPOINTS: Record<string, string> = {
  fast: "https://queue.fal.run/fal-ai/ltx-video",
  quality: "https://queue.fal.run/fal-ai/kling-video/v1/standard/text-to-video",
};

interface FalQueueResp {
  status_url?: string;
  response_url?: string;
  request_id?: string;
}

interface FalStatusResp {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!FAL_KEY) {
    return new Response(
      JSON.stringify({ error: "FAL_KEY nu este configurat" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { prompt?: string; quality?: string; duration?: number };
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

  const endpoint = MODEL_ENDPOINTS[body.quality ?? "fast"] ?? MODEL_ENDPOINTS.fast;

  try {
    // 1. Trimite jobul în coadă
    const submitResp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_frames: 121, // LTX ~5s @ 24fps
        aspect_ratio: "16:9",
      }),
    });

    if (!submitResp.ok) {
      const errText = await submitResp.text();
      console.error("Fal submit fail:", submitResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Fal.ai a respins cererea", details: errText.slice(0, 400) }),
        { status: submitResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const submitted: FalQueueResp = await submitResp.json();
    const statusUrl = submitted.status_url;
    const responseUrl = submitted.response_url;
    if (!statusUrl || !responseUrl) {
      return new Response(
        JSON.stringify({ error: "Răspuns Fal.ai neașteptat", raw: submitted }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Poll status până la COMPLETED sau timeout (~90s)
    const start = Date.now();
    const timeoutMs = 90_000;
    let attempt = 0;
    while (Date.now() - start < timeoutMs) {
      attempt++;
      await sleep(attempt < 3 ? 2000 : 4000);
      const stResp = await fetch(statusUrl, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      if (!stResp.ok) continue;
      const st: FalStatusResp = await stResp.json();
      if (st.status === "COMPLETED") {
        const finalResp = await fetch(responseUrl, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        if (!finalResp.ok) {
          const t = await finalResp.text();
          return new Response(
            JSON.stringify({ error: "Nu am putut prelua rezultatul", details: t.slice(0, 300) }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const result = await finalResp.json();
        const videoUrl =
          result?.video?.url ??
          result?.videos?.[0]?.url ??
          result?.output?.[0] ??
          null;
        if (!videoUrl) {
          return new Response(
            JSON.stringify({ error: "URL video lipsă în răspuns", raw: result }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ videoUrl, prompt, raw: result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (st.status === "FAILED") {
        return new Response(
          JSON.stringify({ error: "Generarea a eșuat pe Fal.ai", raw: st }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Timeout — generarea durează prea mult" }),
      { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
