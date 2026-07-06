import { useState } from "react";
import { Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft, AlertTriangle, Settings as SettingsIcon, Share2, Phone } from "lucide-react";
import { ButiLogo } from "./ButiLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onShare: (c: Conversation) => void;
  open: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
  onStartVoiceCall: () => void;
}


export const Sidebar = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onShare,
  open,
  onToggle,
  onOpenSettings,
}: Props) => {
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[85vw] max-w-[300px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-out md:static md:w-[260px] md:max-w-none md:translate-x-0",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
          open ? "translate-x-0" : "-translate-x-full md:w-0 md:overflow-hidden md:border-r-0",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex items-center gap-2">
            <ButiLogo className="h-8 w-8" />
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              ButiGPT
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-hover transition-colors"
            aria-label="Închide bara laterală"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3">
          <Button
            onClick={onNew}
            className="w-full justify-start gap-2 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-all duration-200 hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Conversație nouă
          </Button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Niciun chat salvat
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => (
                <li key={c.id} className="animate-fade-in">
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-all duration-200 cursor-pointer",
                      activeId === c.id
                        ? "bg-sidebar-hover text-sidebar-foreground"
                        : "text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground",
                    )}
                    onClick={() => onSelect(c.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                    <span className="flex-1 truncate">{c.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(c);
                      }}
                      className="flex-shrink-0 rounded p-1.5 text-muted-foreground opacity-100 transition-all duration-200 hover:text-primary hover:bg-primary/10 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Partajează conversația"
                      title="Partajează"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(c);
                      }}
                      className="flex-shrink-0 rounded p-1.5 text-muted-foreground opacity-100 transition-all duration-200 hover:text-destructive hover:bg-destructive/10 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Șterge conversația"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-sidebar-border px-2 py-2">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            aria-label="Setări"
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Setări</span>
          </button>
        </div>
        <div className="border-t border-sidebar-border px-4 py-2 text-[11px] text-muted-foreground">
          Asistent AI personal
        </div>
      </aside>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent className="border-border bg-surface-1 shadow-glow sm:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30 sm:mx-0">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center sm:text-left">
              Șterge discuția?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center sm:text-left">
              Această acțiune va șterge definitiv{" "}
              <span className="font-semibold text-foreground">
                „{pendingDelete?.title}"
              </span>
              . Nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-lg transition-transform hover:scale-[1.02]">
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="rounded-lg bg-destructive text-destructive-foreground shadow-soft transition-transform hover:scale-[1.02] hover:bg-destructive/90"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const SidebarToggleFloating = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost"
    size="icon"
    onClick={onClick}
    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    aria-label="Deschide bara laterală"
  >
    <PanelLeft className="h-4 w-4" />
  </Button>
);
