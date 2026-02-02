const getDocument = () => {
  if (typeof document === 'undefined') return null;
  return document;
};

export const getFullscreenElement = (doc = getDocument()) => {
  if (!doc) return null;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
};

export const isFullscreenSupported = (element, doc = getDocument()) => {
  if (!doc || !element) return false;
  const canRequest =
    typeof element.requestFullscreen === 'function' ||
    typeof element.webkitRequestFullscreen === 'function' ||
    typeof element.mozRequestFullScreen === 'function' ||
    typeof element.msRequestFullscreen === 'function';
  const canExit =
    typeof doc.exitFullscreen === 'function' ||
    typeof doc.webkitExitFullscreen === 'function' ||
    typeof doc.mozCancelFullScreen === 'function' ||
    typeof doc.msExitFullscreen === 'function';
  return canRequest && canExit;
};

export const isInFullscreen = (doc = getDocument()) => Boolean(getFullscreenElement(doc));

export const requestFullscreen = async (element, { navigationUI } = {}) => {
  if (!element) throw new Error('Elemento inválido para tela cheia.');

  if (typeof element.requestFullscreen === 'function') {
    await element.requestFullscreen(navigationUI ? { navigationUI } : undefined);
    return;
  }

  if (typeof element.webkitRequestFullscreen === 'function') {
    element.webkitRequestFullscreen();
    return;
  }

  if (typeof element.mozRequestFullScreen === 'function') {
    element.mozRequestFullScreen();
    return;
  }

  if (typeof element.msRequestFullscreen === 'function') {
    element.msRequestFullscreen();
    return;
  }

  throw new Error('Seu navegador não suporta modo de tela cheia.');
};

export const exitFullscreen = async (doc = getDocument()) => {
  if (!doc) return;

  if (typeof doc.exitFullscreen === 'function') {
    await doc.exitFullscreen();
    return;
  }
  if (typeof doc.webkitExitFullscreen === 'function') {
    doc.webkitExitFullscreen();
    return;
  }
  if (typeof doc.mozCancelFullScreen === 'function') {
    doc.mozCancelFullScreen();
    return;
  }
  if (typeof doc.msExitFullscreen === 'function') {
    doc.msExitFullscreen();
    return;
  }
};

export const onFullscreenChange = (callback, doc = getDocument()) => {
  if (!doc || typeof callback !== 'function') return () => {};
  const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
  events.forEach((eventName) => doc.addEventListener(eventName, callback));
  return () => events.forEach((eventName) => doc.removeEventListener(eventName, callback));
};

export const applyKioskCssFallback = (enabled) => {
  const doc = getDocument();
  if (!doc) return;
  const root = doc.documentElement;
  const body = doc.body;
  root.classList.toggle('kiosk-fallback', Boolean(enabled));
  if (body) body.classList.toggle('kiosk-fallback', Boolean(enabled));
};

export const tryLockOrientation = async (orientation) => {
  if (typeof window === 'undefined') return;
  const screenOrientation = window.screen?.orientation;
  if (!screenOrientation || typeof screenOrientation.lock !== 'function') {
    throw new Error('Seu navegador não suporta travar orientação de tela.');
  }
  await screenOrientation.lock(orientation);
};

export const unlockOrientation = async () => {
  if (typeof window === 'undefined') return;
  const screenOrientation = window.screen?.orientation;
  if (!screenOrientation) return;
  if (typeof screenOrientation.unlock === 'function') screenOrientation.unlock();
};

export const normalizeFullscreenErrorMessage = (error) => {
  const message = (error && typeof error === 'object' && 'message' in error && error.message) ? String(error.message) : '';
  const name = (error && typeof error === 'object' && 'name' in error && error.name) ? String(error.name) : '';

  if (name === 'NotAllowedError') return 'Toque na tela para ativar o modo quiosque.';
  if (name === 'NotSupportedError') return 'Seu navegador não suporta modo de tela cheia.';
  if (message) return message;
  return 'Não foi possível ativar o modo quiosque.';
};

