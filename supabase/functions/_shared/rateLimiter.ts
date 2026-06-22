/**
 * Rate limiter persistente usando Deno KV.
 *
 * Diferente de Map em memória, o Deno KV persiste entre reinícios do isolate,
 * garantindo que os limites sejam respeitados mesmo com cold starts.
 *
 * Uso:
 *   import { checkRateLimit } from "../_shared/rateLimiter.ts";
 *   const allowed = await checkRateLimit(`ai-advisor:${userId}`, 20, 60_000);
 */

let kv: Deno.Kv | null = null;

async function getKv(): Promise<Deno.Kv> {
  if (!kv) kv = await Deno.openKv();
  return kv;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
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
  const kvKey = ["rate_limit", key];
  const now = Date.now();

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
}
