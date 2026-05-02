import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu ești ButiGPT, un asistent AI personal, prietenos și clar. Răspunzi în limba română când utilizatorul scrie în română. Explici lucrurile simplu, pas cu pas, fără să pari complicat. Poți ajuta cu idei, cod, întrebări generale, explicații, organizare și mici proiecte. Folosește formatare Markdown (titluri, liste, blocuri de cod) când e util. Când nu știi ceva sau nu poți face ceva, spui sincer și oferi o alternativă.

Ai acces la un instrument de generare de imagini (Nano Banana). Dacă utilizatorul îți cere explicit să generezi/desenezi/creezi/faci o poză, imagine, ilustrație, logo, desen sau artwork, apelează funcția "generate_image" cu un prompt detaliat în engleză (mai bune rezultate). NU genera imagini dacă utilizatorul doar întreabă despre o imagine atașată sau cere informații.

PREZENTĂRI POWERPOINT: Dacă utilizatorul îți cere o prezentare PowerPoint, slide-uri, pptx sau ceva similar, răspunde cu o scurtă introducere și apoi include EXACT un bloc de cod fenced cu eticheta "pptx" care conține un JSON valid cu structura:
\`\`\`pptx
{
  "title": "Titlul prezentării",
  "subtitle": "Subtitlu opțional",
  "slides": [
    { "title": "Titlu slide", "bullets": ["Punct 1", "Punct 2", "Punct 3"], "notes": "Note opționale pentru prezentator" }
  ]
}
\`\`\`
Folosește între 5 și 12 slide-uri (în funcție de subiect), 3-6 bullet-uri scurte per slide, fără markdown în interior. Aplicația va construi automat fișierul .pptx descărcabil. NU genera blocul "pptx" dacă utilizatorul nu cere explicit o prezentare.

FIȘIERE ATAȘATE: Utilizatorul îți poate trimite conținutul unor fișiere (PDF, Word, PowerPoint, Excel, text). Va apărea în mesaj sub forma "[Conținutul fișierului ...]". Folosește acel text pentru a răspunde la întrebări, a face rezumate, a citi cu voce, a traduce sau a analiza.`;

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const sseEncoder = new TextEncoder();
const sse = (obj: unknown) => sseEncoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
const sseDone = () => sseEncoder.encode(`data: [DONE]\n\n`);

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.error("image gen failed:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return url ?? null;
  } catch (e) {
    console.error("image gen error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "generate_image",
              description:
                "Generează o imagine pe baza unui prompt detaliat. Folosește doar când utilizatorul cere explicit o poză/imagine/ilustrație.",
              parameters: {
                type: "object",
                properties: {
                  prompt: {
                    type: "string",
                    description: "Prompt detaliat în engleză pentru generarea imaginii.",
                  },
                },
                required: ["prompt"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Limita de cereri atinsă." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "Credit AI epuizat." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We re-stream upstream SSE to the client, intercepting tool calls to
    // generate images and emit a custom SSE event with the image data URL.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Tool-call accumulator: index -> { name, args }
        const toolCalls: Record<number, { name: string; args: string }> = {};

        const flushToolCalls = async () => {
          for (const idx of Object.keys(toolCalls)) {
            const tc = toolCalls[Number(idx)];
            if (tc.name !== "generate_image") continue;
            let prompt = "";
            try {
              const parsed = JSON.parse(tc.args || "{}");
              prompt = parsed.prompt || "";
            } catch {
              prompt = tc.args;
            }
            if (!prompt) continue;

            // Notify client that we're generating
            controller.enqueue(
              sse({
                choices: [
                  {
                    delta: {
                      content: `\n\n_🎨 Generez imaginea: "${prompt}"…_\n\n`,
                    },
                  },
                ],
              }),
            );

            const url = await generateImage(prompt);
            if (url) {
              // Custom event with the image
              controller.enqueue(sse({ buti_image: { url, prompt } }));
            } else {
              controller.enqueue(
                sse({
                  choices: [
                    {
                      delta: {
                        content: `❌ Nu am putut genera imaginea. Încearcă din nou.\n`,
                      },
                    },
                  ],
                }),
              );
            }
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) {
                // forward comments/keepalives as-is
                if (line.length) controller.enqueue(sseEncoder.encode(line + "\n"));
                continue;
              }
              const json = line.slice(6).trim();
              if (json === "[DONE]") {
                continue; // we'll emit our own DONE after tool calls
              }
              try {
                const parsed = JSON.parse(json);
                const delta = parsed.choices?.[0]?.delta;

                // Accumulate tool calls
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const i = tc.index ?? 0;
                    if (!toolCalls[i]) toolCalls[i] = { name: "", args: "" };
                    if (tc.function?.name) toolCalls[i].name = tc.function.name;
                    if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
                  }
                  // Don't forward tool-call deltas to client
                  continue;
                }

                // Forward normal content deltas
                controller.enqueue(sseEncoder.encode(line + "\n\n"));
              } catch {
                // partial — push back
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }

          // After upstream is done, run any tool calls
          if (Object.keys(toolCalls).length > 0) {
            await flushToolCalls();
          }

          controller.enqueue(sseDone());
          controller.close();
        } catch (e) {
          console.error("stream error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
