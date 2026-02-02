import { describe, it, expect } from 'vitest';
import { getUnifiedScore5, getScoreLabel5 } from './ratingUtils';

describe('ratingUtils', () => {
  it('normaliza rating 0-5 para 0-5', () => {
    expect(getUnifiedScore5({ overall_rating: 4 })).toBe(4);
  });

  it('normaliza rating 0-10 para 0-5', () => {
    expect(getUnifiedScore5({ overall_rating: 8 })).toBe(4);
  });

  it('normaliza rating 0-100 para 0-5', () => {
    expect(getUnifiedScore5({ overall_rating: 80 })).toBe(4);
  });

  it('gera label coerente', () => {
    expect(getScoreLabel5(0.5).label).toBe('Muito ruim');
    expect(getScoreLabel5(2.5).label).toBe('Ruim');
    expect(getScoreLabel5(3).label).toBe('Neutra');
    expect(getScoreLabel5(4).label).toBe('Boa');
    expect(getScoreLabel5(5).label).toBe('Excelente');
  });
});

