import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Check, Trash2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  conversationTitle?: string;
}

const makeShareId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-8);
};

export const ShareDialog = ({ open, onOpenChange, conversationId, conversationTitle }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId ? `${window.location.origin}/s/${shareId}` : "";

  useEffect(() => {
    if (!open || !conversationId || !user) return;
    setLoading(true);
    setCopied(false);
    supabase
      .from("conversations")
      .select("share_id, is_public")
      .eq("id", conversationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("share load", error);
        setShareId((data?.share_id as string | null) ?? null);
        setIsPublic(!!data?.is_public);
        setLoading(false);
      });
  }, [open, conversationId, user]);

  const createLink = async () => {
    if (!conversationId || !user) return;
    setBusy(true);
    const newId = shareId ?? makeShareId();
    const { error } = await supabase
      .from("conversations")
      .update({
        share_id: newId,
        is_public: true,
        shared_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
    setBusy(false);
    if (error) {
      console.error(error);
      toast({
        title: "Nu am putut crea linkul",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setShareId(newId);
    setIsPublic(true);
  };

  const revokeLink = async () => {
    if (!conversationId || !user) return;
    setBusy(true);
    const { error } = await supabase
      .from("conversations")
      .update({ is_public: false })
      .eq("id", conversationId);
    setBusy(false);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    setIsPublic(false);
    toast({ title: "Link dezactivat", description: "Conversația nu mai e accesibilă public." });
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: "Link copiat" });
    } catch {
      toast({ title: "Nu am putut copia", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Partajează conversația
          </DialogTitle>
          <DialogDescription>
            {conversationTitle ? `„${conversationTitle}"` : "Creează un link public, doar de citire."}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
            Trebuie să fii conectat pentru a crea un link de partajare. Conversațiile locale nu pot fi partajate.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isPublic && shareId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={copy} aria-label="Copiază">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="outline" asChild aria-label="Deschide">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Oricine cu acest link poate citi conversația. Mesajele trimise după partajare nu apar pentru
              vizitatori până nu reîmprospătează linkul.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={revokeLink}
              disabled={busy}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> Dezactivează linkul
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Va fi generat un link unic pe care îl poți trimite oricui. Vor vedea conversația doar de citire.
            </p>
            <Button
              onClick={createLink}
              disabled={busy}
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Creează link public
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
