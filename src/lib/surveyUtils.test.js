import { describe, it, expect } from 'vitest';
import { getGoogleReviewPostSubmitAction } from './surveyUtils';

describe('surveyUtils - getGoogleReviewPostSubmitAction', () => {
  it('retorna qrcode quando for clicktotem e google_redirect estiver habilitado', () => {
    const action = getGoogleReviewPostSubmitAction(
      { overall_rating: 5 },
      { enabled: true, conditions: [] },
      'clicktotem',
      'https://example.com/google'
    );

    expect(action).toEqual({ mode: 'qrcode', link: 'https://example.com/google' });
  });

  it('não exibe qrcode quando nota for menor que min_rating no clicktotem', () => {
    const action = getGoogleReviewPostSubmitAction(
      { overall_rating: 3 },
      { enabled: true, conditions: [{ min_rating: 4 }] },
      'clicktotem',
      'https://example.com/google'
    );

    expect(action).toEqual({ mode: 'none', link: null });
  });

  it('retorna redirect para canais normais quando condição for atendida', () => {
    const action = getGoogleReviewPostSubmitAction(
      { overall_rating: 5 },
      { enabled: true, conditions: [{ min_rating: 4 }] },
      'qrcode',
      'https://example.com/google'
    );

    expect(action).toEqual({ mode: 'redirect', link: 'https://example.com/google' });
  });

  it('nunca retorna ação no canal totem', () => {
    const action = getGoogleReviewPostSubmitAction(
      { overall_rating: 5 },
      { enabled: true, conditions: [] },
      'totem',
      'https://example.com/google'
    );

    expect(action).toEqual({ mode: 'none', link: null });
  });

  it('não altera o resultado do Google independentemente de existir voucher', () => {
    const baseArgs = [
      { overall_rating: 5 },
      { enabled: true, conditions: [{ min_rating: 4 }] },
      'clicktotem',
      'https://example.com/google'
    ];

    const semVoucher = getGoogleReviewPostSubmitAction(...baseArgs);
    const comVoucher = getGoogleReviewPostSubmitAction(...baseArgs);

    expect(semVoucher).toEqual(comVoucher);
    expect(comVoucher.mode).toBe('qrcode');
  });
});

