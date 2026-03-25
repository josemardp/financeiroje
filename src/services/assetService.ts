
/**
 * FinanceAI — Asset & Net Worth Service
 * 
 * Responsabilidades:
 * 1. CRUD de Ativos (Imóveis, Veículos, Cripto, Investimentos)
 * 2. Registro de valorização e histórico de ativos
 * 3. Cálculo de Net Worth (Ativos + Saldos - Dívidas)
 * 4. Integração com APIs de mercado (Simulado para Tickers/Cripto)
 */

import { supabase } from "@/integrations/supabase/client";

export type AssetType = 'real_estate' | 'vehicle' | 'stock' | 'crypto' | 'fixed_income' | 'cash' | 'other';

export interface Asset {
  id: string;
  user_id: string;
  nome: string;
  tipo: AssetType;
  valor_aquisicao: number;
  valor_atual: number;
  data_aquisicao?: string;
  detalhes?: Record<string, any>;
  instituicao?: string;
  liquidez?: string;
  vencimento?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetValuation {
  id: string;
  asset_id: string;
  valor: number;
  data_referencia: string;
  created_at: string;
}

export interface NetWorthSummary {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  composition: {
    type: AssetType;
    total: number;
    percent: number;
  }[];
}

// ─── CRUD de Ativos ──────────────────────────────────────────

export async function getAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('ativo', true)
    .order('valor_atual', { ascending: false });

  if (error) throw error;
  return data as Asset[];
}

export async function createAsset(asset: Partial<Asset>): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert(asset)
    .select()
    .single();

  if (error) throw error;
  return data as Asset;
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Asset;
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .update({ ativo: false })
    .eq('id', id);

  if (error) throw error;
}

// ─── Histórico e Valorização ──────────────────────────────────

export async function getAssetValuations(assetId: string): Promise<AssetValuation[]> {
  const { data, error } = await supabase
    .from('asset_valuations')
    .select('*')
    .eq('asset_id', assetId)
    .order('data_referencia', { ascending: true });

  if (error) throw error;
  return data as AssetValuation[];
}

// ─── Cálculo de Net Worth ─────────────────────────────────────

export async function getNetWorthSummary(): Promise<NetWorthSummary> {
  // 1. Obter Ativos (Assets)
  const assets = await getAssets();
  
  // 2. Obter Saldos de Contas (Accounts)
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('saldo_atual');
  if (accError) throw accError;

  // 3. Obter Dívidas (Loans)
  const { data: loans, error: loanError } = await supabase
    .from('loans')
    .select('saldo_devedor');
  if (loanError) throw loanError;

  const totalAssetsValue = assets.reduce((sum, a) => sum + Number(a.valor_atual), 0);
  const totalAccountsValue = accounts.reduce((sum, a) => sum + Number(a.saldo_atual), 0);
  const totalLiabilities = loans.reduce((sum, l) => sum + Number(l.saldo_devedor || 0), 0);

  const totalAssets = totalAssetsValue + totalAccountsValue;
  const netWorth = totalAssets - totalLiabilities;

  // Composição por tipo
  const compositionMap = new Map<AssetType, number>();
  assets.forEach(a => {
    compositionMap.set(a.tipo, (compositionMap.get(a.tipo) || 0) + Number(a.valor_atual));
  });
  // Adicionar liquidez das contas como 'cash'
  compositionMap.set('cash', (compositionMap.get('cash') || 0) + totalAccountsValue);

  const composition = Array.from(compositionMap.entries()).map(([type, total]) => ({
    type,
    total,
    percent: totalAssets > 0 ? (total / totalAssets) * 100 : 0
  })).sort((a, b) => b.total - a.total);

  return {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    net_worth: netWorth,
    composition
  };
}
