import { useState } from "react"
import { ChevronLeft, ChevronRight, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/PageHeader"
import { useCompromissos } from "../hooks/useCompromissos"
import { CompromissoCard } from "./CompromissoCard"
import {
  calcularProgresso,
  numeroDiaCiclo,
  formatarDataPtBr,
  diaSemana,
  fraseDodia,
} from "../lib/progressoHoje"
import { CICLO_INICIO } from "../types"
import type { StatusCompromisso } from "../types"

function hoje(): string {
  return new Date().toISOString().split("T")[0]
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split("T")[0]
}

function BarraProgresso({ pct, cor, label }: { pct: number; cor: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${cor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function BlocoOperador({
  titulo,
  compromissos,
  onStatusChange,
  disabled,
}: {
  titulo: string
  compromissos: ReturnType<typeof useCompromissos>["compromissos"]
  onStatusChange: (id: string, status: StatusCompromisso, obs?: string) => void
  disabled: boolean
}) {
  const mv = compromissos.filter((c) => c.nivel === "minimo_viavel")
  const ideal = compromissos.filter((c) => c.nivel === "ideal")

  if (compromissos.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>

      {mv.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Mínimo Viável</p>
          {mv.map((c) => (
            <CompromissoCard key={c.id} compromisso={c} onStatusChange={onStatusChange} disabled={disabled} />
          ))}
        </div>
      )}

      {ideal.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-violet-500 dark:text-violet-400">Ideal</p>
          {ideal.map((c) => (
            <CompromissoCard key={c.id} compromisso={c} onStatusChange={onStatusChange} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PainelHoje() {
  const [dataAtual, setDataAtual] = useState(hoje)
  const { compromissos, isLoading, updateStatus, fecharDia } = useCompromissos(dataAtual)

  const diaCiclo = numeroDiaCiclo(dataAtual, CICLO_INICIO)
  const eHoje = dataAtual === hoje()
  const fora = diaCiclo < 1 || diaCiclo > 30
  const descanso = [3, 10, 17, 24].includes(diaCiclo)

  const josemar = compromissos.filter((c) => c.operador === "josemar")
  const esdra = compromissos.filter((c) => c.operador === "esdra")
  const progresso = calcularProgresso(compromissos)

  function handleStatusChange(id: string, status: StatusCompromisso, obs?: string) {
    updateStatus.mutate({ id, status, observacoes: obs })
  }

  const mutando = updateStatus.isPending || fecharDia.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Painel Esdra Cosméticos"
        description="Compromissos do dia — Manual 30 Dias"
      />

      {/* Navegação de data */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDataAtual((d) => addDias(d, -1))}
          disabled={diaCiclo <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="text-center">
          <p className="font-semibold">{diaSemana(dataAtual)}, {formatarDataPtBr(dataAtual)}</p>
          {!fora && (
            <p className="text-xs text-muted-foreground">
              Dia {diaCiclo} de 30{eHoje ? " · Hoje" : ""}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDataAtual((d) => addDias(d, 1))}
          disabled={diaCiclo >= 30}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Frase bíblica */}
      {!fora && !descanso && (
        <p className="text-xs text-muted-foreground italic text-center px-4">
          {fraseDodia(diaCiclo)}
        </p>
      )}

      {/* Dia de descanso */}
      {descanso && (
        <div className="rounded-lg border bg-muted/40 p-6 text-center space-y-2">
          <p className="text-2xl">🔒</p>
          <p className="font-semibold">Dia de Descanso</p>
          <p className="text-sm text-muted-foreground">
            Fé, filha, família. O negócio sobrevive.
          </p>
        </div>
      )}

      {/* Fora do ciclo */}
      {fora && (
        <div className="rounded-lg border bg-muted/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum compromisso fora do ciclo de 30 dias.</p>
        </div>
      )}

      {/* Conteúdo do dia */}
      {!fora && !descanso && (
        <>
          {/* Barra de progresso */}
          {compromissos.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3">
              <BarraProgresso pct={progresso.mvPct} cor="bg-blue-500" label={`MV: ${progresso.mvCumprido}/${progresso.mvTotal} cumprido${progresso.mvCumprido !== 1 ? "s" : ""}`} />
              {progresso.idealTotal > 0 && (
                <BarraProgresso pct={progresso.idealPct} cor="bg-violet-500" label={`Ideal: ${progresso.idealCumprido}/${progresso.idealTotal} cumprido${progresso.idealCumprido !== 1 ? "s" : ""}`} />
              )}
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          )}

          {!isLoading && compromissos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem compromissos cadastrados para este dia.
            </p>
          )}

          {/* Blocos */}
          <BlocoOperador
            titulo="Josemar"
            compromissos={josemar}
            onStatusChange={handleStatusChange}
            disabled={mutando}
          />

          <BlocoOperador
            titulo="Esdra"
            compromissos={esdra}
            onStatusChange={handleStatusChange}
            disabled={mutando}
          />

          {/* Fechar Dia */}
          {eHoje && compromissos.some((c) => c.status === "pendente") && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-muted-foreground"
                disabled={mutando}
                onClick={() => fecharDia.mutate()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Fechar dia — marcar pendentes como pulados
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
