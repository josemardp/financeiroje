import { describe, it, expect } from 'vitest';
import { normalizeConfidence, detectDivergence, calculateAccuracy } from '../../lib/learningUtils';

describe('Smart Capture Learning Logic (Real)', () => {
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
    
    it('should handle null or empty values', () => {
      expect(normalizeConfidence(null)).toBe('baixa');
      expect(normalizeConfidence('')).toBe('baixa');
    });
  });

  describe('Divergence Detection', () => {
    it('should detect differences in amount', () => {
      const sug = { amount: 100 };
      const fin = { amount: 150 };
      expect(detectDivergence(sug, fin, 'amount')).toBe(true);
    });

    it('should detect differences in description', () => {
      const sug = { description: 'Lunch' };
      const fin = { description: 'Business Dinner' };
      expect(detectDivergence(sug, fin, 'description')).toBe(true);
    });

    it('should return false when values are equal', () => {
      const sug = { type: 'expense' };
      const fin = { type: 'expense' };
      expect(detectDivergence(sug, fin, 'type')).toBe(false);
    });
  });

  describe('Accuracy Calculation', () => {
    it('should calculate correct metrics for a list of records', () => {
      const records = [
        {
          suggested_payload: { amount: 100, type: 'expense' },
          final_payload: { amount: 100, type: 'expense' }
        },
        {
          suggested_payload: { amount: 100, type: 'expense' },
          final_payload: { amount: 150, type: 'expense' }
        }
      ];
      
      const metrics = calculateAccuracy(records);
      expect(metrics?.total).toBe(2);
      expect(metrics?.corrections.amount).toBe(1);
      expect(metrics?.corrections.type).toBe(0);
      expect(metrics?.accuracy.amount).toBe("50.0");
      expect(metrics?.accuracy.type).toBe("100.0");
    });
  });
});
