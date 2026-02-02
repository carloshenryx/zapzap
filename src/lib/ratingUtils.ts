export function isFiniteNumber(value: any): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function extractFirstNumericAnswer(customAnswers: any): number | null {
  if (!customAnswers || typeof customAnswers !== 'object') return null;
  const values = Object.values(customAnswers);
  for (const v of values) {
    if (isFiniteNumber(v)) return v;
  }
  return null;
}

export function normalizeTo10(raw: any): number | null {
  if (!isFiniteNumber(raw)) return null;

  const value = Math.max(0, raw);

  if (value <= 5) return value * 2;
  if (value <= 10) return value;
  if (value <= 100) return value / 10;

  return null;
}

export function normalizeTo5From10(score10: number | null): number | null {
  if (!isFiniteNumber(score10)) return null;
  return score10 / 2;
}

export function getScoreLabel5(score5: number | null): { label: string; className: string } {
  if (!isFiniteNumber(score5)) return { label: 'Sem nota', className: 'bg-gray-100 text-gray-700' };

  if (score5 <= 0.5) return { label: 'Muito ruim', className: 'bg-red-200 text-red-900' };
  if (score5 <= 2.5) return { label: 'Ruim', className: 'bg-red-100 text-red-800' };
  if (score5 < 3.5) return { label: 'Neutra', className: 'bg-yellow-100 text-yellow-800' };
  if (score5 < 4.5) return { label: 'Boa', className: 'bg-green-100 text-green-800' };
  return { label: 'Excelente', className: 'bg-green-200 text-green-900' };
}

export function getUnifiedScore10(response: any): number | null {
  const raw = isFiniteNumber(response?.overall_rating)
    ? response.overall_rating
    : extractFirstNumericAnswer(response?.custom_answers);

  return normalizeTo10(raw);
}

export function getUnifiedScore5(response: any): number | null {
  return normalizeTo5From10(getUnifiedScore10(response));
}

export function isLowScore10(score10: number | null, thresholdInclusive = 4): boolean {
  if (!isFiniteNumber(score10)) return false;
  return score10 <= thresholdInclusive;
}

export function isGoodScore10(score10: number | null, thresholdInclusive = 8): boolean {
  if (!isFiniteNumber(score10)) return false;
  return score10 >= thresholdInclusive;
}
