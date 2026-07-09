import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Video } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGenerate: (prompt: string, quality: "fast" | "quality") => Promise<void> | void;
  isGenerating?: boolean;
}

const SUGGESTIONS = [
  "Un pisoi portocaliu care se joacă în iarbă, cinematic",
  "Valuri lovind stânci la apus, ultra realistic",
  "Un oraș futurist noaptea, luminile pulsează",
  "Un colibri care bea nectar dintr-o floare, slow-motion",
];

export const VideoGenDialog = ({ open, onOpenChange, onGenerate, isGenerating }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState<"fast" | "quality">("fast");

  const submit = async () => {
    const p = prompt.trim();
    if (!p || isGenerating) return;
    await onGenerate(p, quality);
    setPrompt("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!isGenerating || !o) && onOpenChange(o)}>
      <DialogContent className="border-border bg-surface-1 sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle>Generează video</DialogTitle>
              <DialogDescription className="text-xs">
                Descrie ce vrei să apară în clip (5-10 secunde).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
              placeholder="Ex: Un dragon zburând peste un castel medieval la apus, cinematic, 4K"
              className="mt-1.5 min-h-[100px] resize-none"
              disabled={isGenerating}
            />
            <div className="text-right text-[10px] text-muted-foreground mt-1">{prompt.length}/500</div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                disabled={isGenerating}
                className="text-[11px] rounded-full border border-border bg-surface-2 px-2.5 py-1 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <Sparkles className="inline h-2.5 w-2.5 mr-1" />
                {s.length > 40 ? s.slice(0, 40) + "…" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label className="text-sm">Calitate</Label>
              <p className="text-[11px] text-muted-foreground">Rapid ≈ 20s • Calitate ≈ 60s</p>
            </div>
            <Select value={quality} onValueChange={(v) => setQuality(v as "fast" | "quality")} disabled={isGenerating}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Rapid (LTX)</SelectItem>
                <SelectItem value="quality">Calitate (Kling)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={submit}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-gradient-primary text-primary-foreground shadow-glow gap-2 h-11"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Se generează video…</>
            ) : (
              <><Video className="h-4 w-4" /> Generează</>
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Generarea durează 20-90 secunde. Nu închide fila.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
