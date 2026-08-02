// Transcriere audio (STT) prin Lovable AI Gateway — calitate mult mai bună
// decât recunoașterea vocală din browser și suportă româna nativ.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const STT_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MAX_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY nu este configurat" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    const language = form.get("language");

    if (!(file instanceof File) || file.size < 2048) {
      return new Response(
        JSON.stringify({ error: "Fișier audio lipsă sau prea scurt", text: "" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "Audio prea mare (max 20MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-transcribe");
    upstream.append("file", file, "recording.wav");
    // Cod ISO-639-1 simplu; dacă lipsește, modelul detectează automat
    if (typeof language === "string" && /^[a-z]{2}$/.test(language)) {
      upstream.append("language", language);
    }
    upstream.append(
      "prompt",
      "Transcriere fidelă, cu diacritice românești corecte (ă, â, î, ș, ț) și punctuație.",
    );

    const resp = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("STT error:", resp.status, t.slice(0, 300));
      const status = resp.status === 402 || resp.status === 429 ? resp.status : 500;
      return new Response(
        JSON.stringify({ error: `Transcriere eșuată (${resp.status})`, details: t.slice(0, 300) }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ text: (data?.text ?? "").trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
