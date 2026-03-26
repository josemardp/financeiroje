import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Alterar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
          <Sun className="h-4 w-4" /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
          <Moon className="h-4 w-4" /> Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
          <Monitor className="h-4 w-4" /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
