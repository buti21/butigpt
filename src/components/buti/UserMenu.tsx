import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

export const UserMenu = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <Button
        asChild
        size="sm"
        className="rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-all hover:scale-[1.02]"
      >
        <Link to="/auth">
          <LogIn className="h-4 w-4 mr-1.5" />
          Conectează-te
        </Link>
      </Button>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow transition-transform hover:scale-105"
          aria-label="Cont"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-surface-1 border-border">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Conectat ca</span>
            <span className="truncate text-sm">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Deconectează-te
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
