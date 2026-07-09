import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Play, Pause, Volume2, VolumeX, Gauge } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null;
  onClose: () => void;
  title?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer = ({ src, onClose, title }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
  }, [speed, src]);

  useEffect(() => {
    if (!src) {
      setProgress(0);
      setDuration(0);
      setPlaying(false);
    }
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  };

  const handleDownload = async () => {
    if (!src) return;
    setDownloading(true);
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `butigpt-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Video descărcat" });
    } catch (e) {
      console.error(e);
      toast({ title: "Nu am putut descărca", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border bg-black p-0 gap-0 w-screen h-[100dvh] max-w-none rounded-none translate-x-0 translate-y-0 top-0 left-0 sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:h-auto sm:rounded-2xl sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] flex flex-col overflow-hidden">
        <DialogTitle className="sr-only">{title ?? "Video"}</DialogTitle>
        <div className="relative flex-1 flex items-center justify-center bg-black min-h-0">
          {src && (
            <video
              ref={videoRef}
              src={src}
              className="max-h-full max-w-full"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              playsInline
              onClick={togglePlay}
            />
          )}
        </div>

        <div className="bg-surface-1 border-t border-border p-3 sm:p-4 space-y-3">
          {/* Progress */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums w-10 text-right">{fmt(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={progress}
              onChange={(e) => {
                const v = videoRef.current;
                if (v) v.currentTime = parseFloat(e.target.value);
              }}
              className="flex-1 h-1 accent-primary"
            />
            <span className="tabular-nums w-10">{fmt(duration)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="icon" variant="secondary" onClick={togglePlay} className="h-10 w-10 rounded-full">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              className="h-10 w-10 rounded-full"
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <div className="flex items-center gap-1 ml-2 rounded-full bg-surface-2 p-1">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpeed(sp)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full transition-colors",
                    speed === sp
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {sp}x
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="ml-auto gap-1.5"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Se descarcă…" : "Descarcă"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
