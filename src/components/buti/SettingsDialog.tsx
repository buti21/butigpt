import { useState } from "react";
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
} from "lucide-react";
import { useSettings, type ThemeMode, type TypewriterSpeed } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationsCount: number;
  onExport: () => void;
  onClearAll: () => void;
}

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
        <DialogContent className="max-w-2xl border-border bg-surface-1 p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-lg">Setări</DialogTitle>
            <DialogDescription className="sr-only">
              Personalizează ButiGPT
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="flex flex-col sm:flex-row min-h-[440px]">
            <TabsList className="flex sm:flex-col h-auto justify-start gap-1 bg-transparent border-b sm:border-b-0 sm:border-r border-border p-2 sm:p-3 sm:w-44 rounded-none">
              <TabsTrigger value="general" className="w-full justify-start data-[state=active]:bg-secondary">
                General
              </TabsTrigger>
              <TabsTrigger value="chat" className="w-full justify-start data-[state=active]:bg-secondary">
                Chat
              </TabsTrigger>
              <TabsTrigger value="data" className="w-full justify-start data-[state=active]:bg-secondary">
                Date
              </TabsTrigger>
              <TabsTrigger value="account" className="w-full justify-start data-[state=active]:bg-secondary">
                Cont
              </TabsTrigger>
              <TabsTrigger value="about" className="w-full justify-start data-[state=active]:bg-secondary">
                Despre
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 px-6 py-5 overflow-y-auto scrollbar-thin">
              {/* GENERAL */}
              <TabsContent value="general" className="m-0 space-y-6">
                <Row label="Temă" hint="Aspectul vizual al aplicației">
                  <Select
                    value={s.theme}
                    onValueChange={(v) => s.setTheme(v as ThemeMode)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">
                        <span className="flex items-center gap-2"><Moon className="h-4 w-4" /> Întunecat</span>
                      </SelectItem>
                      <SelectItem value="light">
                        <span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Luminos</span>
                      </SelectItem>
                      <SelectItem value="system">
                        <span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Sistem</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
              </TabsContent>

              {/* CHAT */}
              <TabsContent value="chat" className="m-0 space-y-6">
                <Row label="Viteză animație typing" hint="Cât de repede apar literele răspunsului">
                  <Select
                    value={s.typewriterSpeed}
                    onValueChange={(v) => s.setTypewriterSpeed(v as TypewriterSpeed)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Lentă</SelectItem>
                      <SelectItem value="normal">Normală</SelectItem>
                      <SelectItem value="fast">Rapidă</SelectItem>
                      <SelectItem value="instant">Instant</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Citește răspunsurile cu voce" hint="Pornește automat sinteza vocală">
                  <Switch checked={s.autoTts} onCheckedChange={s.setAutoTts} />
                </Row>
                <Row label="Enter trimite mesajul" hint="Shift+Enter pentru rând nou">
                  <Switch checked={s.enterToSend} onCheckedChange={s.setEnterToSend} />
                </Row>
              </TabsContent>

              {/* DATA */}
              <TabsContent value="data" className="m-0 space-y-4">
                <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-center gap-3">
                  {user ? (
                    <Cloud className="h-5 w-5 text-primary flex-shrink-0" />
                  ) : (
                    <CloudOff className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="text-sm">
                    {user ? (
                      <>
                        <div className="font-medium">Sincronizare activă</div>
                        <div className="text-xs text-muted-foreground">
                          Conversațiile sunt salvate pe contul {user.email}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">Sincronizare oprită</div>
                        <div className="text-xs text-muted-foreground">
                          Conectează-te pentru a-ți păstra conversațiile pe toate dispozitivele
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Row label={`Conversații salvate: ${conversationsCount}`} hint="Exportă o copie locală în format JSON">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    disabled={conversationsCount === 0}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" /> Exportă
                  </Button>
                </Row>

                <Row label="Șterge toate conversațiile" hint="Acțiune ireversibilă">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmClear(true)}
                    disabled={conversationsCount === 0}
                    className="gap-2"
                  >
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
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOut();
                        toast({ title: "Deconectat" });
                        onOpenChange(false);
                      }}
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" /> Deconectează-te
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                      Creează un cont pentru a-ți păstra conversațiile sigure și sincronizate.
                    </div>
                    <Button
                      asChild
                      className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                      onClick={() => onOpenChange(false)}
                    >
                      <Link to="/auth">
                        <LogIn className="h-4 w-4" /> Conectează-te
                      </Link>
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ABOUT */}
              <TabsContent value="about" className="m-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">ButiGPT</div>
                    <div className="text-xs text-muted-foreground">Asistent AI personal · v1.0</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ButiGPT este un asistent conversațional construit cu Lovable AI. Trimite mesaje,
                  atașează imagini sau documente și primește răspunsuri inteligente, salvate
                  sigur pe contul tău.
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
              Vei pierde definitiv toate cele {conversationsCount} conversații. Acțiunea nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
              }}
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

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <Label className="text-sm">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);
