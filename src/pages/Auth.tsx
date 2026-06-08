import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { ButiLogo } from "@/components/buti/ButiLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const Auth = () => {
  const { user, signInEmail, signUpEmail, signInGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    const fn = mode === "signin" ? signInEmail : signUpEmail;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) {
      toast({ title: "Eroare", description: error, variant: "destructive" });
      return;
    }
    if (mode === "signup") {
      toast({
        title: "Cont creat",
        description: "Verifică emailul pentru confirmare, apoi loghează-te.",
      });
      setMode("signin");
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInGoogle();
    setBusy(false);
    if (error) toast({ title: "Eroare Google", description: error, variant: "destructive" });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <div className="px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Înapoi
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-primary blur-2xl opacity-40 animate-pulse" />
              <ButiLogo className="h-16 w-16" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Bine ai revenit" : "Creează cont ButiGPT"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Conectează-te pentru a-ți păstra conversațiile sigure."
                : "Salvează-ți conversațiile și accesează-le de oriunde."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-1/60 p-6 shadow-soft">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full justify-center gap-2 rounded-xl border-border bg-surface-2 hover:bg-secondary transition-all hover:scale-[1.01]"
            >
              <GoogleIcon />
              Continuă cu Google
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              sau cu email
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 rounded-xl bg-surface-2 border-border"
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-xs text-muted-foreground">
                  Parolă
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 rounded-xl bg-surface-2 border-border"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-all hover:scale-[1.01]"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Conectează-te"
                ) : (
                  "Creează cont"
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "signin"
                ? "Nu ai cont? Creează unul"
                : "Ai deja cont? Conectează-te"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Contul este opțional. Fără cont, conversațiile rămân salvate doar în acest browser.
          </p>
        </div>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
  </svg>
);

export default Auth;
