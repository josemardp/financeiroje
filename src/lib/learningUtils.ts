export const normalizeConfidence = (conf: string | null): string => {
  if (!conf) return 'baixa';
  const c = conf.toLowerCase();
  if (c === 'high' || c === 'alta') return 'alta';
  if (c === 'medium' || c === 'media' || c === 'média') return 'media';
  return 'baixa';
};

export const detectDivergence = (sug: any, fin: any, field: string): boolean => {
  if (!sug || !fin) return false;
  if (field === 'amount') {
    return Number(sug[field]) !== Number(fin[field]);
  }
  return sug[field] !== fin[field];
};

export const calculateAccuracy = (records: any[]) => {
  if (!records || records.length === 0) return null;
  const total = records.length;
  const corrections = { amount: 0, type: 0, description: 0, category: 0, scope: 0 };

  records.forEach(r => {
    const sug = r.suggested_payload || {};
    const fin = r.final_payload || {};
    if (detectDivergence(sug, fin, 'amount')) corrections.amount++;
    if (detectDivergence(sug, fin, 'type')) corrections.type++;
    if (detectDivergence(sug, fin, 'description')) corrections.description++;
    if (detectDivergence(sug, fin, 'category_id')) corrections.category++;
    if (detectDivergence(sug, fin, 'scope')) corrections.scope++;
  });

  return {
    total,
    corrections,
    accuracy: {
      amount: ((total - corrections.amount) / total * 100).toFixed(1),
      type: ((total - corrections.type) / total * 100).toFixed(1),
      description: ((total - corrections.description) / total * 100).toFixed(1),
      category: ((total - corrections.category) / total * 100).toFixed(1),
      scope: ((total - corrections.scope) / total * 100).toFixed(1),
    }
  };
};
