// Promise-based onay diyalogu — native confirm() yerine.
// Tema uyumlu, klavye erişilebilir, Promise döndürür → await onay(...).
//
// Layouts/default.vue içine <AppOnayModal /> bir kez yerleştirildiğinde,
// herhangi bir sayfadan useOnay() çağrılabilir.

interface OnayIstegi {
  baslik?: string;
  mesaj: string;
  onayMetni?: string;
  iptalMetni?: string;
  tehlikeli?: boolean; // sil/yıkıcı işlemler için kırmızı buton
}

interface OnayBeklemede extends OnayIstegi {
  resolve: (kabul: boolean) => void;
}

const sira = ref<OnayBeklemede | null>(null);

export function useOnay() {
  function onay(istek: OnayIstegi | string): Promise<boolean> {
    const dolu: OnayIstegi = typeof istek === 'string' ? { mesaj: istek } : istek;
    return new Promise((resolve) => {
      sira.value = { ...dolu, resolve };
    });
  }

  function yanitla(kabul: boolean) {
    sira.value?.resolve(kabul);
    sira.value = null;
  }

  return { sira, onay, yanitla };
}
