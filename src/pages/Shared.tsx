import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageBubble, type ChatMessage } from "@/components/buti/MessageBubble";
import { ButiLogo } from "@/components/buti/ButiLogo";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Lock } from "lucide-react";

interface SharedConv {
  title: string;
  messages: ChatMessage[];
  shared_at: string | null;
}

const Shared = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [conv, setConv] = useState<SharedConv | null>(null);

  useEffect(() => {
    if (!shareId) {
      setState("missing");
      return;
    }
    document.title = "Conversație partajată · ButiGPT";
    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("title, messages, shared_at, is_public")
        .eq("share_id", shareId)
        .maybeSingle();
      if (error || !data || !data.is_public) {
        setState("missing");
        return;
      }
      setConv({
        title: data.title,
        messages: (Array.isArray(data.messages) ? data.messages : []) as unknown as ChatMessage[],
        shared_at: data.shared_at as string | null,
      });
      document.title = `${data.title} · ButiGPT`;
      setState("ok");
    })();
  }, [shareId]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2">
          <ButiLogo className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">ButiGPT</div>
            <div className="text-[11px] text-muted-foreground">Conversație partajată</div>
          </div>
        </Link>
        <Button
          asChild
          size="sm"
          className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        >
          <Link to="/">
            Încearcă ButiGPT <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {state === "loading" && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {state === "missing" && (
          <div className="mx-auto mt-20 max-w-md rounded-2xl border border-border bg-surface-1 p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-semibold">Conversația nu există</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Linkul a fost dezactivat sau este invalid.
            </p>
            <Button asChild className="mt-5">
              <Link to="/">Înapoi la ButiGPT</Link>
            </Button>
          </div>
        )}

        {state === "ok" && conv && (
          <>
            <div className="mb-4 border-b border-border/60 pb-4">
              <h1 className="text-xl font-semibold">{conv.title}</h1>
              {conv.shared_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Partajat pe {new Date(conv.shared_at).toLocaleDateString("ro-RO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="pb-10">
              {conv.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {conv.messages.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Conversația este goală.
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Shared;
