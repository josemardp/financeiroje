import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Sparkles, SlidersHorizontal, History, Beaker } from "lucide-react";
import PatternsList from "@/components/ai-memory/PatternsList";
import CoachMemoryList from "@/components/ai-memory/CoachMemoryList";
import AIPreferencesForm from "@/components/ai-memory/AIPreferencesForm";
import CaptureHistoryList from "@/components/ai-memory/CaptureHistoryList";
import AIExperiments from "./AIExperiments";

export default function AIMemory() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Memória da IA"
        description="Controle o que a IA aprendeu sobre você, suas memórias e preferências"
      />
      <Tabs defaultValue="patterns">
        <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:inline-flex">
          <TabsTrigger value="patterns" className="gap-1.5 text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Padrões</span>
          </TabsTrigger>
          <TabsTrigger value="coach" className="gap-1.5 text-xs sm:text-sm">
            <Brain className="h-3.5 w-3.5 shrink-0" />
            <span>Memórias</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5 text-xs sm:text-sm">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Preferências</span>
            <span className="sm:hidden">Prefs.</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5 shrink-0" />
            <span>Capturas</span>
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-1.5 text-xs sm:text-sm">
            <Beaker className="h-3.5 w-3.5 shrink-0" />
            <span>Experimentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="mt-4"><PatternsList /></TabsContent>
        <TabsContent value="coach" className="mt-4"><CoachMemoryList /></TabsContent>
        <TabsContent value="preferences" className="mt-4"><AIPreferencesForm /></TabsContent>
        <TabsContent value="history" className="mt-4"><CaptureHistoryList /></TabsContent>
        <TabsContent value="experiments" className="mt-4"><AIExperiments /></TabsContent>
      </Tabs>
    </div>
  );
}
