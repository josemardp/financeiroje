export interface UserPreferences {
  escopo_padrao?: string;
  reserva_emergencia_valor?: number;
  reserva_emergencia_valor_meta?: number;
  reserva_emergencia_meses_meta?: number;
  renda_principal?: number;
  dia_fechamento?: number;
  [key: string]: unknown;
}
