import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AnomalyResult {
  isHighAnomaly: boolean;
  isMediumAnomaly: boolean;
  expectedRange: { min: number; max: number };
  sampleSize: number;
  isLoading: boolean;
}

export function useTransactionAnomalyCheck(
  userId: string | undefined,
  categoryId: string | null,
  value: number,
  type: string = 'expense'
): AnomalyResult {
  const [stats, setStats] = useState({ 
    p50: 0, p90: 0, n: 0, isLoading: false, lastFetchedCategory: "" 
  });

  useEffect(() => {
    async function fetchHistory() {
      if (!userId || !categoryId || value <= 0 || type !== 'expense') {
        if (stats.n !== 0) setStats({ p50: 0, p90: 0, n: 0, isLoading: false, lastFetchedCategory: "" });
        return;
      }

      // Evita múltiplas queries se a categoria não mudou. 
      if (categoryId === stats.lastFetchedCategory) return;

      setStats(prev => ({ ...prev, isLoading: true }));
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("valor")
          .eq("user_id", userId)
          .eq("categoria_id", categoryId)
          .eq("tipo", 'expense')
          .order("data", { ascending: false })
          .limit(50);

        if (error) throw error;

        if (data && data.length > 0) {
          const values = data.map(d => Number(d.valor)).sort((a, b) => a - b);
          const n = values.length;
          const p50 = values[Math.floor(n * 0.5)];
          const p90 = values[Math.ceil(n * 0.9) - 1];
          setStats({ p50, p90, n, isLoading: false, lastFetchedCategory: categoryId });
        } else {
          setStats({ p50: 0, p90: 0, n: 0, isLoading: false, lastFetchedCategory: categoryId });
        }
      } catch (err) {
        console.error("Erro na detecção de anomalia:", err);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    }
    fetchHistory();
  }, [userId, categoryId, type, value]);

  const isHighAnomaly = stats.n >= 5 && value > stats.p90 * 3;
  const isMediumAnomaly = value > stats.p90 * 2 && !isHighAnomaly;

  return {
    isHighAnomaly,
    isMediumAnomaly,
    expectedRange: { min: stats.p50, max: stats.p90 },
    sampleSize: stats.n,
    isLoading: stats.isLoading
  };
}
