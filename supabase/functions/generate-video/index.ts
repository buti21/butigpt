// Generează un videoclip scurt prin Hugging Face Inference Providers (gratuit cu HF_TOKEN)
// Rulează pe Deno (Supabase Edge Functions).

import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HF_TOKEN = Deno.env.get("HF_TOKEN");

// Modele text-to-video pe Hugging Face (rutare automată către provider)
const MODELS: Record<string, string[]> = {
  // rapid: LTX distilled (foarte rapid), fallback Wan 5B
  fast: ["Lightricks/LTX-Video-0.9.8-13B-distilled", "Wan-AI/Wan2.2-TI2V-5B"],
  // calitate: Wan 5B, fallback LTX
  quality: ["Wan-AI/Wan2.2-TI2V-5B", "Lightricks/LTX-Video-0.9.8-13B-distilled"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!HF_TOKEN) {
    return new Response(
      JSON.stringify({ error: "HF_TOKEN nu este configurat" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { prompt?: string; quality?: string };
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

  const models = MODELS[body.quality ?? "fast"] ?? MODELS.fast;
  const errors: string[] = [];

  for (const model of models) {
    try {
      const resp = await fetch(`https://router.huggingface.co/v1/models/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "video/mp4",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { num_frames: 97, num_inference_steps: 20 },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("HF video error:", model, resp.status, t.slice(0, 300));
        errors.push(`${model}: ${resp.status} ${t.slice(0, 200)}`);
        continue;
      }

      const contentType = resp.headers.get("content-type") ?? "";

      // Unele provideri răspund cu JSON care conține un URL
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        const url =
          data?.video?.url ??
          data?.videos?.[0]?.url ??
          data?.output?.[0] ??
          data?.url ??
          null;
        if (url) {
          return new Response(JSON.stringify({ videoUrl: url, prompt, model }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        errors.push(`${model}: răspuns JSON fără URL video`);
        continue;
      }

      // Altfel primim bytes video direct
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.length < 1000) {
        errors.push(`${model}: răspuns video prea mic`);
        continue;
      }
      const mime = contentType.startsWith("video/") ? contentType : "video/mp4";
      return new Response(
        JSON.stringify({
          videoUrl: `data:${mime};base64,${base64Encode(buf)}`,
          prompt,
          model,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      console.error("HF video exception:", model, e);
      errors.push(`${model}: ${e instanceof Error ? e.message : "eroare"}`);
    }
  }

  return new Response(
    JSON.stringify({
      error: "Nu am putut genera videoclipul",
      details: errors.join(" | ").slice(0, 600),
    }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
