import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { isDemoMode, createMockQueryBuilder } from '@/services/demoMode/mockSupabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key';

const rawClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const supabase = new Proxy(rawClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => {
        if (isDemoMode()) {
          return createMockQueryBuilder(table);
        }
        return target.from(table as any);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});