// src/services/aiAdvisor/promptSanitizer.ts

const KNOWN_JAILBREAK_PATTERNS = [
  /ignore\s+previous\s+instructions/gi,
  /you\s+are\s+now/gi,
  /system:/gi,
  /forget\s+everything/gi,
  /new\s+instructions/gi,
  /roleplay\s+as/gi,
  /disregard/gi,
  /pretend/gi,
  /act\s+as/gi,
  /override/gi,
  /<system>/gi,
  /<\/system>/gi,
  /<instruction>/gi,
  /<\/instruction>/gi,
  /\[\[SYSTEM\]\]/gi,
  /\bsudo\b/gi,
  /\bdrop\s+table\b/gi,
  /\brm\s+-rf\b/gi,
  /\bexec\s*\(/gi,
  /\bDAN\b/gi
];

/**
 * Sanitiza inputs do usuário para prevenir Prompt Injection e Jailbreak.
 * Bloqueia padrões conhecidos e isola semanticamente em tags <user_data>.
 */
export function sanitizePromptContext(input: string | null | undefined): string {
  if (!input) return "<user_data>\n\n</user_data>";

  let sanitized = input;

  // 1. Bloqueia tentativa de fechar a tag de isolamento prematuramente
  sanitized = sanitized.replace(/<\/user_data>/gi, "[TAG_BREAKOUT_ATTEMPT]");

  // 2. Remove padrões conhecidos de jailbreak
  KNOWN_JAILBREAK_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, "[REDACTED_COMMAND]");
  });

  // 3. Envolve em tags de isolamento
  return `<user_data>\n${sanitized.trim()}\n</user_data>`;
}
