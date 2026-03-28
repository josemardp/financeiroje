import { describe, it, expect } from 'vitest';

// Mock simple normalization logic for testing
const normalizeConfidence = (conf: string | null): string => {
  if (!conf) return 'baixa';
  const c = conf.toLowerCase();
  if (c === 'high' || c === 'alta') return 'alta';
  if (c === 'medium' || c === 'media' || c === 'média') return 'media';
  return 'baixa';
};

// Mock divergence detection logic
const detectDivergences = (sug: any, fin: any) => {
  const fields = ['amount', 'type', 'description', 'category_id', 'scope'];
  return fields.filter(field => {
    if (field === 'amount') return Number(sug[field]) !== Number(fin[field]);
    return sug[field] !== fin[field];
  });
};

describe('Smart Capture Learning Logic', () => {
  describe('Confidence Normalization', () => {
    it('should normalize English values to Portuguese', () => {
      expect(normalizeConfidence('high')).toBe('alta');
      expect(normalizeConfidence('medium')).toBe('media');
      expect(normalizeConfidence('low')).toBe('baixa');
    });

    it('should handle Portuguese values correctly', () => {
      expect(normalizeConfidence('alta')).toBe('alta');
      expect(normalizeConfidence('media')).toBe('media');
      expect(normalizeConfidence('média')).toBe('media');
      expect(normalizeConfidence('baixa')).toBe('baixa');
    });

    it('should handle case sensitivity', () => {
      expect(normalizeConfidence('HIGH')).toBe('alta');
      expect(normalizeConfidence('BAIXA')).toBe('baixa');
    });
  });

  describe('Divergence Detection', () => {
    it('should detect differences in amount', () => {
      const sug = { amount: 100 };
      const fin = { amount: 150 };
      expect(detectDivergences(sug, fin)).toContain('amount');
    });

    it('should detect differences in description', () => {
      const sug = { description: 'Lunch' };
      const fin = { description: 'Business Dinner' };
      expect(detectDivergences(sug, fin)).toContain('description');
    });

    it('should detect multiple differences', () => {
      const sug = { amount: 100, type: 'expense', scope: 'personal' };
      const fin = { amount: 100, type: 'income', scope: 'business' };
      const divs = detectDivergences(sug, fin);
      expect(divs).toContain('type');
      expect(divs).toContain('scope');
      expect(divs).not.toContain('amount');
    });
  });
});
