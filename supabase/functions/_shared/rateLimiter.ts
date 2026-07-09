/**
 * Rate limiter com Deno KV quando disponível.
 *
 * O Supabase Edge Runtime pode não expor `Deno.openKv`. Nesse caso, usa um
 * fallback em memória por isolate para que a ausência do KV nunca derrube a
 * função principal. Quando o KV estiver disponível, o limite permanece
 * persistente entre reinícios.
 *
 * Uso:
 *   import { checkRateLimit } from "../_shared/rateLimiter.ts";
 *   const allowed = await checkRateLimit(`ai-advisor:${userId}`, 20, 60_000);
 */

let kv: Deno.Kv | null = null;
const memoryEntries = new Map<string, RateLimitEntry>();

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

type DenoWithOptionalKv = typeof Deno & {
  openKv?: () => Promise<Deno.Kv>;
};

async function getKv(): Promise<Deno.Kv | null> {
  const openKv = (Deno as DenoWithOptionalKv).openKv;
  if (typeof openKv !== "function") return null;

  try {
    if (!kv) kv = await openKv();
    return kv;
  } catch (error) {
    console.warn("Rate limiter: Deno KV indisponível; usando fallback em memória.", error);
    return null;
  }
}

function checkMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number
): boolean {
  const entry = memoryEntries.get(key);

  if (!entry || now > entry.resetAt) {
    memoryEntries.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count += 1;
  return true;
}

/**
 * Verifica e incrementa o contador de rate limit.
 * @param key   Chave única (ex: "ai-advisor:uuid-do-usuario")
 * @param max   Máximo de requisições permitidas na janela
 * @param windowMs Duração da janela em ms
 * @returns true se a requisição é permitida, false se o limite foi atingido
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const store = await getKv();
  const now = Date.now();

  if (!store) return checkMemoryRateLimit(key, max, windowMs, now);

  const kvKey = ["rate_limit", key];

  try {
    // Tentamos até 3 vezes em caso de conflito de escrita atômica
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await store.get<RateLimitEntry>(kvKey);
      const entry = result.value;

      if (!entry || now > entry.resetAt) {
        const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
        const commit = await store.atomic()
          .check(result)
          .set(kvKey, newEntry, { expireIn: windowMs })
          .commit();
        if (commit.ok) return true;
        continue;
      }

      if (entry.count >= max) return false;

      const newEntry: RateLimitEntry = { count: entry.count + 1, resetAt: entry.resetAt };
      const ttl = Math.max(1, entry.resetAt - now);
      const commit = await store.atomic()
        .check(result)
        .set(kvKey, newEntry, { expireIn: ttl })
        .commit();
      if (commit.ok) return true;
    }

    // Fallback seguro: permite a requisição se houve conflito persistente (improvável)
    return true;
  } catch (error) {
    console.warn("Rate limiter: falha no Deno KV; usando fallback em memória.", error);
    return checkMemoryRateLimit(key, max, windowMs, now);
  }
}
