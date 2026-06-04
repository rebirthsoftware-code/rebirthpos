import { defineStore } from 'pinia';

export interface SubeOzet {
  id: string;
  ad: string;
  firma?: { id: string; ad: string };
}

/**
 * Aktif şube — kategoriler, ürünler, masalar gibi şubeye bağlı
 * verilerin hangi şubeden geleceğini belirler.
 */
export const useSubeStore = defineStore('sube', {
  state: () => ({
    aktifSubeId: '' as string,
    subeler: [] as SubeOzet[],
    yukleniyor: false,
  }),

  getters: {
    aktifSube(state): SubeOzet | undefined {
      return state.subeler.find((s) => s.id === state.aktifSubeId);
    },
  },

  actions: {
    async yukle() {
      this.yukleniyor = true;
      try {
        this.subeler = await apiFetch<SubeOzet[]>('/subeler');
        if (!this.aktifSubeId && this.subeler.length) {
          this.aktifSec(this.subeler[0].id);
        } else if (this.aktifSubeId && !this.subeler.find((s) => s.id === this.aktifSubeId)) {
          this.aktifSec(this.subeler[0]?.id || '');
        }
      } finally {
        this.yukleniyor = false;
      }
    },

    aktifSec(id: string) {
      this.aktifSubeId = id;
      if (import.meta.client) {
        localStorage.setItem('rebirth-aktif-sube', id);
      }
    },

    yukleAktifSube() {
      if (import.meta.client) {
        const id = localStorage.getItem('rebirth-aktif-sube');
        if (id) this.aktifSubeId = id;
      }
    },
  },
});
