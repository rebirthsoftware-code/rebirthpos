/**
 * Preload — Renderer (Nuxt) ile Main process arasındaki güvenli köprü.
 * `window.rebirth` üzerinden frontend erişir.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rebirth', {
  // Ayarlar
  ayar: {
    al: (anahtar) => ipcRenderer.invoke('ayar:al', anahtar),
    kaydet: (anahtar, deger) => ipcRenderer.invoke('ayar:kaydet', anahtar, deger),
  },

  // Uygulama
  uygulama: {
    bilgi: () => ipcRenderer.invoke('uygulama:bilgi'),
  },

  // Pencere kontrolü
  pencere: {
    tamEkran: () => ipcRenderer.invoke('pencere:tam-ekran'),
    kucuk: () => ipcRenderer.invoke('pencere:kucuk'),
    kapat: () => ipcRenderer.invoke('pencere:kapat'),
  },

  // Yazıcı
  yazici: {
    liste: () => ipcRenderer.invoke('yazici:liste'),
    yazdir: (icerik, ayarlar) => ipcRenderer.invoke('yazici:yazdir', icerik, ayarlar),
    testFis: (yaziciAdi) => ipcRenderer.invoke('yazici:test', yaziciAdi),
  },

  // İşletim sistemi bilgisi
  platform: process.platform,
  isElectron: true,
});

// Frontend bu flag ile masaüstü/web ayırımı yapabilir
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('electron-app');
});
