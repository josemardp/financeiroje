import type { Compromisso, ProgressoHoje } from "../types"

export function calcularProgresso(compromissos: Compromisso[]): ProgressoHoje {
  const mv = compromissos.filter((c) => c.nivel === "minimo_viavel")
  const ideal = compromissos.filter((c) => c.nivel === "ideal")
  const mvCumprido = mv.filter((c) => c.status === "cumprido").length
  const idealCumprido = ideal.filter((c) => c.status === "cumprido").length
  return {
    mvTotal: mv.length,
    mvCumprido,
    mvPct: mv.length > 0 ? Math.round((mvCumprido / mv.length) * 100) : 0,
    idealTotal: ideal.length,
    idealCumprido,
    idealPct: ideal.length > 0 ? Math.round((idealCumprido / ideal.length) * 100) : 0,
  }
}

export function numeroDiaCiclo(data: string, cicloInicio: string): number {
  const d1 = new Date(cicloInicio + "T12:00:00Z")
  const d2 = new Date(data + "T12:00:00Z")
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1
}

export function formatarDataPtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
  return `${day} de ${meses[month - 1]} de ${year}`
}

export function diaSemana(isoDate: string): string {
  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
  return dias[new Date(isoDate + "T12:00:00Z").getUTCDay()]
}

const FRASES = [
  "Entrega tuas obras ao Senhor, e teus pensamentos serão estabelecidos. — Pv 16:3",
  "Tudo o que fizerem, façam de todo o coração, como para o Senhor. — Cl 3:23",
  "O diligente nos seus negócios estará diante dos reis. — Pv 22:29",
  "Não nos cansemos de fazer o bem, porque a seu tempo ceifaremos. — Gl 6:9",
  "Confia ao Senhor as tuas obras, e os teus planos serão estabelecidos. — Pv 16:3",
  "O plano do diligente certamente dará lucro. — Pv 21:5",
  "Seja forte e corajoso. Não se apavore nem desanime. — Js 1:9",
  "Com toda a humildade e mansidão, com longanimidade, suportando uns aos outros. — Ef 4:2",
]

export function fraseDodia(diaCiclo: number): string {
  return FRASES[(diaCiclo - 1) % FRASES.length]
}
