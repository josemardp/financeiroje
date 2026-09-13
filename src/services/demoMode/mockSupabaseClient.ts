/**
 * Interceptor do cliente Supabase para o Modo Demonstração.
 * Retorna dados fictícios locais quando isDemoMode() é verdadeiro,
 * evitando erros de rede e dispensando backend real.
 */

import {
  DEMO_ACCOUNTS,
  DEMO_CATEGORIES,
  DEMO_GOALS,
  DEMO_TRANSACTIONS,
  DEMO_ALERTS,
  DEMO_USER_ID,
  isDemoMode,
} from "./demoData";

function getTableRecords(table: string): any[] {
  switch (table) {
    case "transactions":
      return [...DEMO_TRANSACTIONS];
    case "categories":
      return [...DEMO_CATEGORIES];
    case "accounts":
      return [...DEMO_ACCOUNTS];
    case "goals":
      return [...DEMO_GOALS];
    case "alerts":
      return [...DEMO_ALERTS];
    case "profiles":
      return [
        {
          id: DEMO_USER_ID,
          user_id: DEMO_USER_ID,
          nome: "Avaliador Portfólio",
          email: "recrutador@demo.local",
          perfil: "admin",
          familia_id: null,
          avatar_url: null,
          preferences: {},
        },
      ];
    case "user_achievements":
      return [];
    default:
      return [];
  }
}

export function createMockQueryBuilder(table: string) {
  let records = getTableRecords(table);

  const builder: any = {
    select: (_cols?: string) => builder,
    order: (col: string, opts?: { ascending?: boolean }) => {
      const asc = opts?.ascending ?? true;
      records.sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
      return builder;
    },
    limit: (n: number) => {
      records = records.slice(0, n);
      return builder;
    },
    eq: (col: string, val: any) => {
      records = records.filter((r) => r[col] === val);
      return builder;
    },
    gte: (col: string, val: any) => {
      records = records.filter((r) => r[col] >= val);
      return builder;
    },
    lte: (col: string, val: any) => {
      records = records.filter((r) => r[col] <= val);
      return builder;
    },
    ilike: (col: string, val: string) => {
      const q = val.replace(/%/g, "").toLowerCase();
      records = records.filter((r) => String(r[col] || "").toLowerCase().includes(q));
      return builder;
    },
    is: (col: string, val: any) => {
      records = records.filter((r) => r[col] === val);
      return builder;
    },
    not: (col: string, _op: string, val: any) => {
      records = records.filter((r) => r[col] !== val);
      return builder;
    },
    or: (_conditions: string) => builder,
    in: (col: string, vals: any[]) => {
      records = records.filter((r) => vals.includes(r[col]));
      return builder;
    },
    single: async () => ({ data: records[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: records[0] ?? null, error: null }),
    insert: async (data: any) => {
      const inserted = Array.isArray(data) ? data : [data];
      return { data: inserted, error: null };
    },
    update: (data: any) => ({
      eq: async (col: string, val: any) => {
        records.forEach((r) => {
          if (r[col] === val) Object.assign(r, data);
        });
        return { data: records, error: null };
      },
    }),
    delete: () => ({
      eq: async (col: string, val: any) => {
        records = records.filter((r) => r[col] !== val);
        return { data: records, error: null };
      },
    }),
    then: (resolve: (res: { data: any[]; error: null }) => any, reject?: (err: any) => any) => {
      return Promise.resolve({ data: records, error: null }).then(resolve, reject);
    },
  };

  return builder;
}

export { isDemoMode };
