import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import type { Compromisso, StatusCompromisso } from "../types"

function rowToCompromisso(row: Record<string, unknown>): Compromisso {
  return {
    id: row.id as string,
    data: row.data as string,
    operador: row.operador as Compromisso["operador"],
    bloco: row.bloco as string,
    descricao: row.descricao as string,
    nivel: row.nivel as Compromisso["nivel"],
    tempo_estimado_min: row.tempo_estimado_min as number | null,
    status: (row.status ?? "pendente") as StatusCompromisso,
    observacoes: row.observacoes as string | null,
    ordem: row.ordem as number,
  }
}

export function useCompromissos(data: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const qKey = ["compromissos", data, user?.id]

  const query = useQuery({
    queryKey: qKey,
    enabled: !!user,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("esdra_compromissos_diarios")
        .select("*")
        .eq("user_id", user!.id)
        .eq("data", data)
        .order("operador")
        .order("nivel")
        .order("ordem")
      if (error) throw error
      return (rows ?? []).map((r) => rowToCompromisso(r as Record<string, unknown>))
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      observacoes,
    }: {
      id: string
      status: StatusCompromisso
      observacoes?: string
    }) => {
      const { error } = await supabase
        .from("esdra_compromissos_diarios")
        .update({ status, ...(observacoes !== undefined ? { observacoes } : {}) })
        .eq("id", id)
        .eq("user_id", user!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  const fecharDia = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("esdra_compromissos_diarios")
        .update({ status: "pulado" })
        .eq("user_id", user!.id)
        .eq("data", data)
        .eq("status", "pendente")
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  })

  return {
    compromissos: query.data ?? [],
    isLoading: query.isLoading,
    updateStatus,
    fecharDia,
  }
}
