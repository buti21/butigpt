// Generează un videoclip scurt prin Hugging Face Inference Providers (HF_TOKEN)
// Rulează pe Deno (Supabase Edge Functions).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HF_TOKEN = Deno.env.get("HF_TOKEN");
const ROUTER = "https://router.huggingface.co";

// Rute HF Router (provider + providerId), în ordine de fallback
const ROUTES: Record<string, string[]> = {
  // rapid & ieftin
  fast: [
    "/fal-ai/fal-ai/wan/v2.2-5b/text-to-video",
    "/fal-ai/fal-ai/ltx-video-13b-distilled",
    "/fal-ai/fal-ai/wan/v2.1/1.3b/text-to-video",
  ],
  // calitate mai bună
  quality: [
    "/fal-ai/fal-ai/wan/v2.2-a14b/text-to-video",
    "/fal-ai/fal-ai/wan/v2.2-5b/text-to-video",
    "/fal-ai/fal-ai/ltx-video-13b-distilled",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!HF_TOKEN) {
    return new Response(JSON.stringify({ error: "HF_TOKEN nu este configurat" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  const routes = ROUTES[body.quality ?? "fast"] ?? ROUTES.fast;
  const errors: string[] = [];

  for (const route of routes) {
    try {
      const resp = await fetch(`${ROUTER}${route}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const contentType = resp.headers.get("content-type") ?? "";

      if (!resp.ok) {
        const t = await resp.text();
        console.error("HF video error:", route, resp.status, t.slice(0, 300));
        // Credit HF epuizat / token fără permisiuni → mesaj clar, fără fallback inutil
        if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
          return new Response(
            JSON.stringify({
              error:
                resp.status === 401 || resp.status === 403
                  ? "Tokenul Hugging Face nu are permisiunea „Inference Providers”. Generează un token nou cu acea permisiune."
                  : "Creditul Hugging Face pentru Inference Providers este epuizat. Adaugă credit sau așteaptă resetarea lunară.",
              details: t.slice(0, 300),
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        errors.push(`${route}: ${resp.status} ${t.slice(0, 150)}`);
        continue;
      }

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        const url =
          data?.video?.url ??
          data?.videos?.[0]?.url ??
          data?.output?.[0] ??
          data?.url ??
          null;
        if (url) {
          return new Response(JSON.stringify({ videoUrl: url, prompt, model: route }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        errors.push(`${route}: răspuns fără URL video`);
        continue;
      }

      // Unele provideri întorc bytes video direct
      const buf = new Uint8Array(await resp.arrayBuffer());
      if (buf.length < 1000) {
        errors.push(`${route}: răspuns video prea mic`);
        continue;
      }
      let binary = "";
      for (let i = 0; i < buf.length; i += 8192) {
        binary += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return new Response(
        JSON.stringify({
          videoUrl: `data:video/mp4;base64,${btoa(binary)}`,
          prompt,
          model: route,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (e) {
      console.error("HF video exception:", route, e);
      errors.push(`${route}: ${e instanceof Error ? e.message : "eroare"}`);
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
