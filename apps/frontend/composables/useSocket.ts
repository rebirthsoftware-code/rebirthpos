// Eski: Socket.IO ile canlı (WebSocket) güncelleme.
// Yeni: WebSocket kaldırıldı (backend Vercel serverless'ta çalışsın diye).
// Bunun yerine "polling" — kayıtlı geri çağrılar belli aralıkla tetiklenir,
// böylece sayfalar verilerini periyodik olarak yeniden çeker (near-live).
//
// API aynı kaldı: pages `const { on } = useSocket(); on('olay', () => listele())`
// kullanmaya devam ediyor. `on`'a gelen callback artık her tick'te (payload'sız)
// çağrılır — yani "bir şey değişmiş olabilir, yeniden çek" anlamında.

const POLL_MS = 5000;

let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => {
    listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        /* sayfa geçişinde stale callback olabilir; yut */
      }
    });
  }, POLL_MS);
}

function clearTimerIfIdle() {
  if (listeners.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function useSocket() {
  if (!import.meta.client) {
    return {
      socket: null,
      bagla: () => {},
      subeOdasinaKatil: (_: string) => {},
      on: () => () => {},
      kapat: () => {},
    };
  }

  function on<T = any>(_olay: string, callback: (veri: T) => void): () => void {
    // Polling: olay adını yok say, callback'i periyodik tetikle (payload yok).
    const fn = () => callback(undefined as unknown as T);
    listeners.add(fn);
    ensureTimer();
    return () => {
      listeners.delete(fn);
      clearTimerIfIdle();
    };
  }

  function kapat() {
    listeners.clear();
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // bagla / subeOdasinaKatil artık no-op (WebSocket yok) — sayfalar çağırmaya devam edebilir.
  return {
    socket: null,
    bagla: () => {},
    subeOdasinaKatil: (_: string) => {},
    on,
    kapat,
  };
}
