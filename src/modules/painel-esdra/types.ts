export type StatusCompromisso = "pendente" | "cumprido" | "pulado"
export type NivelCompromisso = "minimo_viavel" | "ideal"
export type OperadorCompromisso = "josemar" | "esdra"

export interface Compromisso {
  id: string
  data: string
  operador: OperadorCompromisso
  bloco: string
  descricao: string
  nivel: NivelCompromisso
  tempo_estimado_min: number | null
  status: StatusCompromisso
  observacoes: string | null
  ordem: number
}

export interface ProgressoHoje {
  mvTotal: number
  mvCumprido: number
  mvPct: number
  idealTotal: number
  idealCumprido: number
  idealPct: number
}

export const CICLO_INICIO = "2026-06-22"
