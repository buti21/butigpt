import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sun,
  Moon,
  Monitor,
  Download,
  Trash2,
  LogIn,
  LogOut,
  Cloud,
  CloudOff,
  AlertTriangle,
  Sparkles,
  Video,
  Play,
  Square,
  Loader2,
  Check,
} from "lucide-react";
import {
  useSettings,
  type ThemeMode,
  type ColorTheme,
  type TypewriterSpeed,
  type ModelChoice,
  type ResponseLanguage,
  type ResponseTone,
} from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { TTS_VOICES } from "@/lib/voices";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationsCount: number;
  onExport: () => void;
  onClearAll: () => void;
}

const COLOR_SWATCHES: { value: ColorTheme; label: string; bg: string }[] = [
  { value: "violet", label: "Violet", bg: "linear-gradient(135deg,#8b5cf6,#c084fc)" },
  { value: "ocean", label: "Ocean", bg: "linear-gradient(135deg,#0ea5e9,#14b8a6)" },
  { value: "sunset", label: "Sunset", bg: "linear-gradient(135deg,#f97316,#ec4899)" },
  { value: "forest", label: "Forest", bg: "linear-gradient(135deg,#22c55e,#84cc16)" },
  { value: "mono", label: "Mono", bg: "linear-gradient(135deg,#9ca3af,#4b5563)" },
];

export const SettingsDialog = ({
  open,
  onOpenChange,
  conversationsCount,
  onExport,
  onClearAll,
}: Props) => {
  const s = useSettings();
  const { user, signOut } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "border-border bg-surface-1 p-0 gap-0 overflow-hidden flex flex-col",
            // Fullscreen on mobile, centered card on ≥sm
            "w-screen h-[100dvh] max-w-none rounded-none translate-x-0 translate-y-0 top-0 left-0 data-[state=open]:slide-in-from-bottom-4",
            "sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0"
          )}
        >
          <DialogHeader className="px-5 sm:px-6 pt-4 pb-3 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg">Setări</DialogTitle>
            <DialogDescription className="sr-only">
              Personalizează ButiGPT
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex flex-col sm:flex-row flex-1 min-h-0">
            <div className="relative sm:contents flex-shrink-0">
              <TabsList className="flex sm:flex-col h-auto justify-start gap-1 bg-transparent border-b sm:border-b-0 sm:border-r border-border p-2 sm:p-3 sm:w-44 rounded-none overflow-x-auto sm:overflow-x-visible flex-shrink-0 scrollbar-thin w-full">
                {[
                  ["general", "General"],
                  ["personalize", "Personalizare"],
                  ["chat", "Chat"],
                  ["voice", "Voce"],
                  ["privacy", "Confidențialitate"],
                  ["data", "Date"],
                  ["account", "Cont"],
                  ["labs", "Laborator"],
                  ["about", "Despre"],
                ].map(([v, label]) => (
                  <TabsTrigger
                    key={v}
                    value={v}
                    className="sm:w-full justify-start data-[state=active]:bg-secondary whitespace-nowrap text-xs sm:text-sm"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Fade hint that tabs scroll horizontally on mobile */}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-surface-1 to-transparent sm:hidden" />
            </div>

            <div className="flex-1 px-5 sm:px-6 py-5 overflow-y-auto scrollbar-thin min-h-0">
              {/* GENERAL */}
              <TabsContent value="general" className="m-0 space-y-6">
                <Row label="Temă" hint="Aspectul vizual al aplicației">
                  <Select value={s.theme} onValueChange={(v) => s.setTheme(v as ThemeMode)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Întunecat</span></SelectItem>
                      <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Luminos</span></SelectItem>
                      <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Sistem</span></SelectItem>
                    </SelectContent>
                  </Select>
                </Row>

                <div>
                  <Label className="text-sm">Culoare de accent</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">Culoarea principală a butoanelor și accentelor</p>
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => s.setColorTheme(c.value)}
                        className={cn(
                          "group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all",
                          s.colorTheme === c.value
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="h-8 w-8 rounded-full shadow-inner" style={{ background: c.bg }} />
                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Row label="Mod compact" hint="Mesaje mai dense, mai puțin spațiu">
                  <Switch checked={s.compactMode} onCheckedChange={s.setCompactMode} />
                </Row>
                <Row label="Afișează ora mesajelor" hint="Sub fiecare mesaj">
                  <Switch checked={s.showTimestamps} onCheckedChange={s.setShowTimestamps} />
                </Row>
              </TabsContent>

              {/* PERSONALIZE */}
              <TabsContent value="personalize" className="m-0 space-y-5">
                <div>
                  <Label className="text-sm">Despre tine</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Cum te numești, ce faci, interese — ButiGPT va folosi asta pentru a răspunde mai bine.
                  </p>
                  <Textarea
                    value={s.aboutYou}
                    onChange={(e) => s.setAboutYou(e.target.value.slice(0, 1500))}
                    placeholder="Ex: Mă cheamă Andrei, sunt dezvoltator web și învăț franceză."
                    className="min-h-[90px] resize-none"
                  />
                  <div className="text-right text-[10px] text-muted-foreground mt-1">{s.aboutYou.length}/1500</div>
                </div>

                <div>
                  <Label className="text-sm">Instrucțiuni personalizate</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Cum vrei ca ButiGPT să-ți răspundă (stil, format, reguli).
                  </p>
                  <Textarea
                    value={s.customInstructions}
                    onChange={(e) => s.setCustomInstructions(e.target.value.slice(0, 1500))}
                    placeholder="Ex: Răspunde scurt, fără introduceri. Folosește bullet points. Adaugă mereu un exemplu."
                    className="min-h-[90px] resize-none"
                  />
                  <div className="text-right text-[10px] text-muted-foreground mt-1">{s.customInstructions.length}/1500</div>
                </div>

                <Row label="Limbă răspuns" hint="Forțează o anumită limbă">
                  <Select value={s.language} onValueChange={(v) => s.setLanguage(v as ResponseLanguage)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (după mesaj)</SelectItem>
                      <SelectItem value="ro">Română</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="it">Italiano</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>

                <Row label="Ton" hint="Stilul răspunsurilor">
                  <Select value={s.tone} onValueChange={(v) => s.setTone(v as ResponseTone)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Implicit</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="concise">Concis</SelectItem>
                      <SelectItem value="playful">Jucăuș</SelectItem>
                      <SelectItem value="expert">Expert tehnic</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
              </TabsContent>

              {/* CHAT */}
              <TabsContent value="chat" className="m-0 space-y-5">
                <Row label="Model" hint="Viteză vs. calitate vs. economic">
                  <Select value={s.model} onValueChange={(v) => s.setModel(v as ModelChoice)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">ButiGPT Rapid</SelectItem>
                      <SelectItem value="smart">ButiGPT Pro (calitate)</SelectItem>
                      <SelectItem value="lite">ButiGPT Lite (economic)</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Viteză typing" hint="Cât de repede apar literele">
                  <Select value={s.typewriterSpeed} onValueChange={(v) => s.setTypewriterSpeed(v as TypewriterSpeed)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Lentă</SelectItem>
                      <SelectItem value="normal">Normală</SelectItem>
                      <SelectItem value="fast">Rapidă</SelectItem>
                      <SelectItem value="instant">Instant</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Enter trimite mesajul" hint="Shift+Enter pentru rând nou">
                  <Switch checked={s.enterToSend} onCheckedChange={s.setEnterToSend} />
                </Row>
                <Row label="Sugestii follow-up" hint="Întrebări recomandate sub răspunsuri (în curând)">
                  <Switch checked={s.followUps} onCheckedChange={s.setFollowUps} />
                </Row>
              </TabsContent>

              {/* VOICE */}
              <TabsContent value="voice" className="m-0 space-y-5">
                <Row label="Citește automat răspunsurile" hint="Pornește sinteza vocală pentru fiecare răspuns">
                  <Switch checked={s.autoTts} onCheckedChange={s.setAutoTts} />
                </Row>
                <div>
                  <Label className="text-sm">Voce</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Folosită la citirea răspunsurilor și în apelul vocal. Apasă ▶ pentru a asculta o mostră.
                  </p>
                  <VoicePicker value={s.ttsVoiceId} onChange={s.setTtsVoiceId} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm">Viteză citire</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.ttsSpeed.toFixed(2)}x</p>
                    </div>
                  </div>
                  <Slider
                    min={0.5}
                    max={1.75}
                    step={0.05}
                    value={[s.ttsSpeed]}
                    onValueChange={(v) => s.setTtsSpeed(v[0])}
                  />
                </div>
              </TabsContent>

              {/* PRIVACY */}
              <TabsContent value="privacy" className="m-0 space-y-5">
                <Row label="Salvează istoricul" hint="Când e oprit, mesajele nu sunt păstrate">
                  <Switch checked={s.saveHistory} onCheckedChange={s.setSaveHistory} />
                </Row>
                <Row label="Contribuie la îmbunătățirea modelului" hint="Permite folosirea anonimă a conversațiilor">
                  <Switch checked={s.improveModel} onCheckedChange={s.setImproveModel} />
                </Row>
                <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs text-muted-foreground leading-relaxed">
                  ButiGPT nu vinde datele tale. Conversațiile sunt vizibile doar contului tău.
                </div>
              </TabsContent>

              {/* DATA */}
              <TabsContent value="data" className="m-0 space-y-4">
                <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-center gap-3">
                  {user ? <Cloud className="h-5 w-5 text-primary flex-shrink-0" /> : <CloudOff className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                  <div className="text-sm min-w-0">
                    {user ? (
                      <>
                        <div className="font-medium">Sincronizare activă</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">Doar local</div>
                        <div className="text-xs text-muted-foreground">Conectează-te pentru sincronizare</div>
                      </>
                    )}
                  </div>
                </div>
                <Row label={`Conversații: ${conversationsCount}`} hint="Exportă o copie în JSON">
                  <Button variant="outline" size="sm" onClick={onExport} disabled={conversationsCount === 0} className="gap-2">
                    <Download className="h-4 w-4" /> Exportă
                  </Button>
                </Row>
                <Row label="Șterge toate" hint="Acțiune ireversibilă">
                  <Button variant="destructive" size="sm" onClick={() => setConfirmClear(true)} disabled={conversationsCount === 0} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Șterge tot
                  </Button>
                </Row>
              </TabsContent>

              {/* ACCOUNT */}
              <TabsContent value="account" className="m-0 space-y-5">
                {user ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shadow-glow">
                        {(user.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{user.email}</div>
                        <div className="text-xs text-muted-foreground">Conectat</div>
                      </div>
                    </div>
                    <Button variant="outline" onClick={async () => { await signOut(); toast({ title: "Deconectat" }); onOpenChange(false); }} className="gap-2">
                      <LogOut className="h-4 w-4" /> Deconectează-te
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                      Creează un cont pentru a-ți păstra conversațiile sincronizate.
                    </div>
                    <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90" onClick={() => onOpenChange(false)}>
                      <Link to="/auth"><LogIn className="h-4 w-4" /> Conectează-te</Link>
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* LABS */}
              <TabsContent value="labs" className="m-0 space-y-4">
                <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Video className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      Generare video AI
                      <span className="text-[10px] uppercase tracking-wider rounded-full bg-primary/15 text-primary px-2 py-0.5">În curând</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Lucrăm la integrarea generării de videoclipuri scurte direct din chat.
                      Va necesita un provider extern (Runway, Replicate, Luma).
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground leading-relaxed">
                  Funcții experimentale apar aici primele. Trimite feedback dacă vrei ceva specific.
                </div>
              </TabsContent>

              {/* ABOUT */}
              <TabsContent value="about" className="m-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">ButiGPT</div>
                    <div className="text-xs text-muted-foreground">Asistent AI personal · v1.1</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ButiGPT este un asistent conversațional construit cu Lovable AI.
                  Trimite mesaje, atașează imagini sau documente și primește răspunsuri inteligente.
                </p>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="border-border bg-surface-1">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30 sm:mx-0">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle>Șterge toate conversațiile?</AlertDialogTitle>
            <AlertDialogDescription>
              Vei pierde definitiv toate cele {conversationsCount} conversații.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onClearAll(); setConfirmClear(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Șterge tot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const VoicePicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const stop = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const preview = async (voice: { id: string; label: string }) => {
    if (playingId === voice.id || loadingId === voice.id) {
      stop();
      return;
    }
    stop();
    setLoadingId(voice.id);
    try {
      let dataUrl = cacheRef.current.get(voice.id);
      if (!dataUrl) {
        const resp = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ text: `Salut, eu sunt ${voice.label}.`, voiceId: voice.id }),
        });
        if (!resp.ok) throw new Error("preview failed");
        const data = await resp.json();
        if (!data?.audioContent) throw new Error("no audio");
        dataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        cacheRef.current.set(voice.id, dataUrl);
      }
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.onended = () => { if (audioRef.current === audio) { audioRef.current = null; setPlayingId(null); } };
      audio.onerror = () => { if (audioRef.current === audio) { audioRef.current = null; setPlayingId(null); } };
      await audio.play();
      setPlayingId(voice.id);
    } catch (e) {
      console.error(e);
      toast({ title: "Nu am putut reda mostra", description: "Reîncearcă în câteva secunde.", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const renderRow = (v: typeof TTS_VOICES[number]) => {
    const selected = value === v.id;
    const isPlaying = playingId === v.id;
    const isLoading = loadingId === v.id;
    return (
      <div
        key={v.id}
        className={cn(
          "flex items-center gap-2 rounded-lg border p-2 transition-colors",
          selected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
        )}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); preview(v); }}
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors",
            isPlaying && "bg-primary text-primary-foreground border-primary"
          )}
          aria-label={`Previzualizează vocea ${v.label}`}
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isPlaying ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        </button>
        <button
          type="button"
          onClick={() => onChange(v.id)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{v.label}</span>
            {selected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{v.description}</div>
        </button>
      </div>
    );
  };

  useEffect(() => () => stop(), []);

  const females = TTS_VOICES.filter((v) => v.gender === "female");
  const males = TTS_VOICES.filter((v) => v.gender === "male");

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Femei</div>
        <div className="grid gap-1.5">{females.map(renderRow)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Bărbați</div>
        <div className="grid gap-1.5">{males.map(renderRow)}</div>
      </div>
    </div>
  );
};
