import { Sparkles } from "lucide-react";

export const ButiLogo = ({ className = "h-9 w-9" }: { className?: string }) => (
  <div
    className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-primary shadow-glow ${className}`}
    aria-hidden
  >
    <Sparkles className="h-1/2 w-1/2 text-primary-foreground" strokeWidth={2.4} />
  </div>
);
