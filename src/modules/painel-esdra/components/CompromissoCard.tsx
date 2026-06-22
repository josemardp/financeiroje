import { useState } from "react"
import { CheckCircle2, Circle, SkipForward, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Compromisso, StatusCompromisso } from "../types"

interface Props {
  compromisso: Compromisso
  onStatusChange: (id: string, status: StatusCompromisso, observacoes?: string) => void
  disabled?: boolean
}

const BLOCO_LABEL: Record<string, string> = {
  planejamento: "Planejamento",
  tecnologia: "Tecnologia",
  vendas: "Vendas",
  marketing: "Marketing",
  atendimento: "Atendimento",
  crm: "CRM",
  estoque: "Estoque",
  financeiro: "Financeiro",
  decisao: "Decisão",
  operacional: "Operacional",
}

export function CompromissoCard({ compromisso, onStatusChange, disabled }: Props) {
  const [expandido, setExpandido] = useState(false)
  const [obs, setObs] = useState(compromisso.observacoes ?? "")
  const { id, status, nivel, bloco, descricao, tempo_estimado_min } = compromisso

  function ciclar() {
    const proximo: StatusCompromisso =
      status === "pendente" ? "cumprido" : status === "cumprido" ? "pulado" : "pendente"
    onStatusChange(id, proximo)
  }

  function salvarObs() {
    onStatusChange(id, status, obs)
    setExpandido(false)
  }

  const corStatus =
    status === "cumprido"
      ? "border-l-green-500 bg-green-50 dark:bg-green-950/20"
      : status === "pulado"
        ? "border-l-slate-300 bg-slate-50 dark:bg-slate-900/20 opacity-60"
        : nivel === "minimo_viavel"
          ? "border-l-blue-500 bg-white dark:bg-card"
          : "border-l-violet-400 bg-white dark:bg-card"

  const IconeStatus =
    status === "cumprido" ? CheckCircle2 : status === "pulado" ? SkipForward : Circle

  const corIcone =
    status === "cumprido"
      ? "text-green-500"
      : status === "pulado"
        ? "text-slate-400"
        : nivel === "minimo_viavel"
          ? "text-blue-500"
          : "text-violet-400"

  return (
    <div className={`border-l-4 rounded-r-lg px-3 py-2 shadow-sm ${corStatus}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={ciclar}
          disabled={disabled}
          className={`mt-0.5 shrink-0 ${corIcone} hover:opacity-70 transition-opacity`}
          title="Clique para alternar: pendente → cumprido → pulado"
        >
          <IconeStatus className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 mb-0.5">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {BLOCO_LABEL[bloco] ?? bloco}
            </span>
            {tempo_estimado_min && (
              <span className="text-xs text-muted-foreground">{tempo_estimado_min}min</span>
            )}
          </div>
          <p className={`text-sm leading-snug ${status === "pulado" ? "line-through text-muted-foreground" : ""}`}>
            {descricao}
          </p>

          <button
            onClick={() => setExpandido((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {compromisso.observacoes ? "Ver observação" : "Adicionar observação"}
          </button>

          {expandido && (
            <div className="mt-2 space-y-1">
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Como foi? O que aconteceu?"
                className="text-sm min-h-[60px]"
              />
              <Button size="sm" variant="outline" onClick={salvarObs} disabled={disabled}>
                Salvar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
