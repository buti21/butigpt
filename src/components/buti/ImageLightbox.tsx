import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  src: string | null;
  onClose: () => void;
}

export const ImageLightbox = ({ src, onClose }: Props) => {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;

  const handleDownload = async () => {
    try {
      let blob: Blob;
      if (src.startsWith("data:")) {
        const res = await fetch(src);
        blob = await res.blob();
      } else {
        const res = await fetch(src, { mode: "cors" });
        blob = await res.blob();
      }
      const ext = (blob.type.split("/")[1] || "png").split(";")[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `butigpt-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // Fallback: open in new tab
      const a = document.createElement("a");
      a.href = src;
      a.download = `butigpt-${Date.now()}.png`;
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({
        title: "Descărcare directă indisponibilă",
        description: "Imaginea s-a deschis într-o filă nouă — folosește „Salvează ca…”.",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="absolute right-3 top-3 flex gap-2">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="h-10 w-10 rounded-full shadow-soft"
          aria-label="Descarcă imaginea"
          title="Descarcă"
        >
          <Download className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="h-10 w-10 rounded-full shadow-soft"
          aria-label="Închide"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <img
        src={src}
        alt="Imagine mărită"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-glow"
      />
    </div>
  );
};
