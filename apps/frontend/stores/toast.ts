import { defineStore } from 'pinia';

export type ToastTip = 'basari' | 'hata' | 'uyari' | 'bilgi';

export interface Toast {
  id: number;
  tip: ToastTip;
  baslik?: string;
  mesaj: string;
  sure: number;
}

let sayac = 0;

export const useToastStore = defineStore('toast', {
  state: () => ({
    listesi: [] as Toast[],
  }),

  actions: {
    goster(tip: ToastTip, mesaj: string, opts: { baslik?: string; sure?: number } = {}) {
      const id = ++sayac;
      const t: Toast = {
        id,
        tip,
        baslik: opts.baslik,
        mesaj,
        sure: opts.sure ?? 4000,
      };
      this.listesi.push(t);
      if (t.sure > 0) {
        setTimeout(() => this.kapat(id), t.sure);
      }
    },

    basari(mesaj: string, baslik?: string) {
      this.goster('basari', mesaj, { baslik });
    },
    hata(mesaj: string, baslik?: string) {
      this.goster('hata', mesaj, { baslik, sure: 6000 });
    },
    uyari(mesaj: string, baslik?: string) {
      this.goster('uyari', mesaj, { baslik });
    },
    bilgi(mesaj: string, baslik?: string) {
      this.goster('bilgi', mesaj, { baslik });
    },

    kapat(id: number) {
      this.listesi = this.listesi.filter((t) => t.id !== id);
    },
  },
});
