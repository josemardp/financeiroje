import { useScope, ScopeType } from "@/contexts/ScopeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, Users, Briefcase, LayoutGrid, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ScopeSwitcher() {
  const { currentScope, setScope, scopeLabel } = useScope();

  const getIcon = (scope: ScopeType) => {
    switch (scope) {
      case "private": return <User className="h-4 w-4" />;
      case "family": return <Users className="h-4 w-4" />;
      case "business": return <Briefcase className="h-4 w-4" />;
      case "all": return <LayoutGrid className="h-4 w-4" />;
    }
  };

  const getBadgeVariant = (scope: ScopeType) => {
    switch (scope) {
      case "private": return "default";
      case "family": return "secondary";
      case "business": return "destructive";
      case "all": return "outline";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 border-dashed px-3">
          {getIcon(currentScope)}
          <span className="hidden sm:inline-block font-medium">{scopeLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Alternar Contexto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => setScope("private")} className="gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>Pessoal</span>
          {currentScope === "private" && <Badge className="ml-auto h-5 px-1.5" variant="default">Ativo</Badge>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setScope("family")} className="gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Família</span>
          {currentScope === "family" && <Badge className="ml-auto h-5 px-1.5" variant="secondary">Ativo</Badge>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setScope("business")} className="gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span>Negócio</span>
          {currentScope === "business" && <Badge className="ml-auto h-5 px-1.5" variant="destructive">Ativo</Badge>}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => setScope("all")} className="gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <span>Visão Geral</span>
          {currentScope === "all" && <Badge className="ml-auto h-5 px-1.5" variant="outline">Ativo</Badge>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
