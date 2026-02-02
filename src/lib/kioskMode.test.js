import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyKioskCssFallback,
  exitFullscreen,
  getFullscreenElement,
  isFullscreenSupported,
  normalizeFullscreenErrorMessage,
  requestFullscreen,
} from './kioskMode';

const createClassList = () => {
  const set = new Set();
  return {
    toggle: (name, force) => {
      const shouldAdd = force === undefined ? !set.has(name) : Boolean(force);
      if (shouldAdd) set.add(name);
      else set.delete(name);
    },
    has: (name) => set.has(name),
  };
};

describe('kioskMode', () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('normaliza o fullscreenElement com prioridades', () => {
    expect(getFullscreenElement({ fullscreenElement: 'a' })).toBe('a');
    expect(getFullscreenElement({ webkitFullscreenElement: 'b' })).toBe('b');
    expect(getFullscreenElement({ mozFullScreenElement: 'c' })).toBe('c');
    expect(getFullscreenElement({ msFullscreenElement: 'd' })).toBe('d');
    expect(getFullscreenElement({})).toBe(null);
  });

  it('detecta suporte a fullscreen considerando request e exit', () => {
    const el = { webkitRequestFullscreen: () => {} };
    const doc = { webkitExitFullscreen: () => {} };
    expect(isFullscreenSupported(el, doc)).toBe(true);
    expect(isFullscreenSupported(null, doc)).toBe(false);
  });

  it('usa requestFullscreen padrão quando disponível', async () => {
    const fn = vi.fn(() => Promise.resolve());
    const el = { requestFullscreen: fn };
    await requestFullscreen(el, { navigationUI: 'hide' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('usa webkitRequestFullscreen quando padrão não existe', async () => {
    const fn = vi.fn();
    const el = { webkitRequestFullscreen: fn };
    await requestFullscreen(el);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('usa exitFullscreen padrão quando disponível', async () => {
    const fn = vi.fn(() => Promise.resolve());
    const doc = { exitFullscreen: fn };
    await exitFullscreen(doc);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('aplica e remove a classe kiosk-fallback em html/body', () => {
    const htmlClassList = createClassList();
    const bodyClassList = createClassList();
    globalThis.document = {
      documentElement: { classList: htmlClassList },
      body: { classList: bodyClassList },
    };

    applyKioskCssFallback(true);
    expect(htmlClassList.has('kiosk-fallback')).toBe(true);
    expect(bodyClassList.has('kiosk-fallback')).toBe(true);

    applyKioskCssFallback(false);
    expect(htmlClassList.has('kiosk-fallback')).toBe(false);
    expect(bodyClassList.has('kiosk-fallback')).toBe(false);
  });

  it('normaliza mensagens comuns de erro', () => {
    expect(normalizeFullscreenErrorMessage({ name: 'NotAllowedError' })).toMatch('Toque');
    expect(normalizeFullscreenErrorMessage({ name: 'NotSupportedError' })).toMatch('não suporta');
    expect(normalizeFullscreenErrorMessage(new Error('x'))).toBe('x');
  });
});
