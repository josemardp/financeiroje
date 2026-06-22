import { describe, it, expect } from "vitest"
import {
  calcularProgresso,
  numeroDiaCiclo,
  formatarDataPtBr,
  diaSemana,
  fraseDodia,
} from "../progressoHoje"
import type { Compromisso } from "../../types"

function mk(nivel: "minimo_viavel" | "ideal", status: "pendente" | "cumprido" | "pulado"): Compromisso {
  return { id: "x", data: "2026-06-22", operador: "josemar", bloco: "b", descricao: "d",
    nivel, tempo_estimado_min: 30, status, observacoes: null, ordem: 1 }
}

describe("calcularProgresso", () => {
  it("retorna zeros quando lista vazia", () => {
    const p = calcularProgresso([])
    expect(p.mvTotal).toBe(0)
    expect(p.mvPct).toBe(0)
    expect(p.idealTotal).toBe(0)
    expect(p.idealPct).toBe(0)
  })

  it("conta MV cumprido corretamente", () => {
    const lista = [
      mk("minimo_viavel", "cumprido"),
      mk("minimo_viavel", "cumprido"),
      mk("minimo_viavel", "pendente"),
    ]
    const p = calcularProgresso(lista)
    expect(p.mvTotal).toBe(3)
    expect(p.mvCumprido).toBe(2)
    expect(p.mvPct).toBe(67)
  })

  it("conta Ideal cumprido corretamente", () => {
    const lista = [mk("ideal", "cumprido"), mk("ideal", "pulado")]
    const p = calcularProgresso(lista)
    expect(p.idealTotal).toBe(2)
    expect(p.idealCumprido).toBe(1)
    expect(p.idealPct).toBe(50)
  })

  it("pulado não conta como cumprido", () => {
    const lista = [mk("minimo_viavel", "pulado"), mk("minimo_viavel", "pulado")]
    const p = calcularProgresso(lista)
    expect(p.mvCumprido).toBe(0)
    expect(p.mvPct).toBe(0)
  })

  it("100% quando todos cumpridos", () => {
    const lista = [mk("minimo_viavel", "cumprido"), mk("ideal", "cumprido")]
    const p = calcularProgresso(lista)
    expect(p.mvPct).toBe(100)
    expect(p.idealPct).toBe(100)
  })

  it("MV e Ideal são contados separadamente", () => {
    const lista = [
      mk("minimo_viavel", "cumprido"),
      mk("ideal", "pendente"),
    ]
    const p = calcularProgresso(lista)
    expect(p.mvPct).toBe(100)
    expect(p.idealPct).toBe(0)
  })
})

describe("numeroDiaCiclo", () => {
  it("Dia 1 = data de início", () => {
    expect(numeroDiaCiclo("2026-06-22", "2026-06-22")).toBe(1)
  })

  it("Dia 2 = início + 1 dia", () => {
    expect(numeroDiaCiclo("2026-06-23", "2026-06-22")).toBe(2)
  })

  it("Dia 30 = início + 29 dias", () => {
    expect(numeroDiaCiclo("2026-07-21", "2026-06-22")).toBe(30)
  })
})

describe("formatarDataPtBr", () => {
  it("formata data corretamente", () => {
    expect(formatarDataPtBr("2026-06-22")).toBe("22 de jun de 2026")
  })

  it("formata janeiro corretamente", () => {
    expect(formatarDataPtBr("2026-01-01")).toBe("1 de jan de 2026")
  })
})

describe("diaSemana", () => {
  it("22/06/2026 é segunda-feira", () => {
    expect(diaSemana("2026-06-22")).toBe("Segunda")
  })

  it("24/06/2026 é quarta-feira", () => {
    expect(diaSemana("2026-06-24")).toBe("Quarta")
  })
})

describe("fraseDodia", () => {
  it("retorna string não vazia para qualquer dia", () => {
    for (let d = 1; d <= 30; d++) {
      expect(fraseDodia(d).length).toBeGreaterThan(0)
    }
  })

  it("cicla após o último índice", () => {
    expect(fraseDodia(1)).toBe(fraseDodia(9))
  })
})
