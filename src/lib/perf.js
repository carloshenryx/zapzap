const STORE_KEY = 'app_perf_v1';
const DEBUG_KEY = 'perf_debug';

function safeNow() {
  try {
    return performance.now();
  } catch (_) {
    return Date.now();
  }
}

function safeMark(name) {
  try {
    performance.mark(name);
    return;
  } catch (_) {
    return;
  }
}

function safeMeasure(name, start, end) {
  try {
    performance.measure(name, start, end);
    const entries = performance.getEntriesByName(name);
    const last = entries[entries.length - 1];
    return typeof last?.duration === 'number' ? last.duration : null;
  } catch (_) {
    return null;
  }
}

function safeReadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function safeWriteStore(items) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch (_) {
    return;
  }
}

function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function perfMark(name) {
  safeMark(name);
}

export function perfLog(event) {
  const entry = {
    ts: Date.now(),
    ...event,
  };
  const items = safeReadStore();
  items.push(entry);
  const trimmed = items.length > 200 ? items.slice(items.length - 200) : items;
  safeWriteStore(trimmed);

  if (isDebugEnabled()) {
    const label = entry?.name ? `PERF ${entry.name}` : 'PERF';
    try {
      console.log(label, entry);
    } catch (_) {
      return;
    }
  }
}

export function perfMeasure({ name, startMark, endMark, extra }) {
  const duration = safeMeasure(name, startMark, endMark);
  perfLog({
    name,
    duration_ms: typeof duration === 'number' ? Math.round(duration) : null,
    startMark,
    endMark,
    now_ms: Math.round(safeNow()),
    ...extra,
  });
  return duration;
}

