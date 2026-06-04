import { defineStore } from 'pinia';

export type Rol =
  | 'SUPER_ADMIN'
  | 'FIRMA_ADMIN'
  | 'SUBE_MUDURU'
  | 'KASIYER'
  | 'GARSON'
  | 'MUTFAK'
  | 'KURYE';

export interface KullaniciOzet {
  adSoyad: string;
  eposta: string;
  rol: Rol;
}

interface LoginYanit {
  accessToken: string;
  refreshToken: string;
  user: KullaniciOzet;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    refreshToken: '' as string,
    user: null as KullaniciOzet | null,
  }),

  getters: {
    girisYapilmis: (s) => !!s.accessToken && !!s.user,
    rol: (s) => s.user?.rol,
  },

  actions: {
    async login(eposta: string, sifre: string) {
      const config = useRuntimeConfig();
      const yanit = await $fetch<LoginYanit>('/auth/login', {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { eposta, sifre },
      });
      this.accessToken = yanit.accessToken;
      this.refreshToken = yanit.refreshToken;
      this.user = yanit.user;
      this.persistEt();
    },

    cikis() {
      this.accessToken = '';
      this.refreshToken = '';
      this.user = null;
      if (import.meta.client) {
        localStorage.removeItem('rebirth-auth');
      }
    },

    async tokenYenile(): Promise<boolean> {
      if (!this.refreshToken) return false;
      try {
        const config = useRuntimeConfig();
        const yanit = await $fetch<LoginYanit>('/auth/refresh', {
          baseURL: config.public.apiBase,
          method: 'POST',
          body: { refreshToken: this.refreshToken },
        });
        this.accessToken = yanit.accessToken;
        this.refreshToken = yanit.refreshToken;
        this.user = yanit.user;
        this.persistEt();
        return true;
      } catch {
        return false;
      }
    },

    persistEt() {
      if (import.meta.client) {
        localStorage.setItem(
          'rebirth-auth',
          JSON.stringify({
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            user: this.user,
          }),
        );
      }
    },

    yukle() {
      if (import.meta.client) {
        const raw = localStorage.getItem('rebirth-auth');
        if (raw) {
          try {
            const data = JSON.parse(raw);
            this.accessToken = data.accessToken || '';
            this.refreshToken = data.refreshToken || '';
            this.user = data.user || null;
          } catch {}
        }
      }
    },
  },
});
