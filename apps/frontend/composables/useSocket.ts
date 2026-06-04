import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let aktifOda: string = '';
let bagliToken: string = '';

/**
 * Tüm sayfalar tek bir socket bağlantısı paylaşır.
 * Şube değişince eski odadan çıkıp yenisine katılır.
 * Backend JWT zorunlu; token değişirse bağlantı yenilenir.
 */
export function useSocket() {
  if (!import.meta.client) {
    return {
      socket: null as Socket | null,
      bagla: () => {},
      subeOdasinaKatil: (_: string) => {},
      on: () => () => {},
      kapat: () => {},
    };
  }

  function bagla() {
    const auth = useAuthStore();
    const token = auth.accessToken;
    if (!token) return;
    // Token değiştiyse eski bağlantıyı kapat
    if (socket && bagliToken && bagliToken !== token) {
      socket.disconnect();
      socket = null;
      aktifOda = '';
    }
    if (socket?.connected) return;
    const config = useRuntimeConfig();
    const base = String(config.public.apiBase).replace(/\/api\/?$/, '');
    socket = io(base, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });
    bagliToken = token;
    socket.on('connect_error', (e: any) => {
      // Sunucu token reddederse sessiz tekrar denemeyelim
      if (e?.message?.toLowerCase?.().includes('unauthorized')) {
        socket?.disconnect();
        socket = null;
      }
    });
  }

  function subeOdasinaKatil(subeId: string) {
    if (!socket) bagla();
    if (!socket || !subeId || subeId === aktifOda) return;
    aktifOda = subeId;
    socket.emit('join', { subeId });
  }

  function on<T = any>(olay: string, callback: (veri: T) => void): () => void {
    if (!socket) bagla();
    socket?.on(olay, callback);
    return () => socket?.off(olay, callback);
  }

  function kapat() {
    socket?.disconnect();
    socket = null;
    aktifOda = '';
    bagliToken = '';
  }

  return { socket, bagla, subeOdasinaKatil, on, kapat };
}
