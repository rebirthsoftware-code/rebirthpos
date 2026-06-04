/**
 * Yazıcı bridge — Electron'un sistem yazıcı API'sini kullanır.
 *
 * Bu sürüm: sistem yazıcılarına HTML/PDF gönderir.
 * Sonraki sürümde: ESC/POS direkt termal yazıcı desteği eklenecek
 * (`node-thermal-printer` veya `escpos` paketi ile).
 */
const { BrowserWindow, webContents } = require('electron');

module.exports = function (ipcMain, log) {
  // Sistem yazıcılarının listesi
  ipcMain.handle('yazici:liste', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    try {
      const yazicilar = await win.webContents.getPrintersAsync();
      return yazicilar.map((p) => ({
        ad: p.name,
        gorunenAd: p.displayName,
        aciklama: p.description,
        durum: p.status,
        varsayilan: p.isDefault,
      }));
    } catch (e) {
      log.error('Yazıcı listesi alınamadı:', e.message);
      return [];
    }
  });

  // HTML içeriği yazdır (görünmez pencerede render edip basar)
  ipcMain.handle('yazici:yazdir', async (_e, html, ayarlar = {}) => {
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 800,
      webPreferences: { offscreen: true },
    });

    try {
      const tamHtml = `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><style>
          @page { margin: 0; size: ${ayarlar.kagit || '80mm'} auto; }
          body { margin: 0; padding: 4mm; font-family: monospace; font-size: 11px; color: #000; background: #fff; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .lg { font-size: 14px; }
          .xl { font-size: 16px; }
          hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 1px 0; }
        </style></head><body>${html}</body></html>
      `;

      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(tamHtml));

      return new Promise((resolve) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: ayarlar.yaziciAdi || undefined,
            margins: { marginType: 'none' },
            copies: ayarlar.kopya || 1,
          },
          (basarili, sebep) => {
            win.close();
            if (basarili) {
              log.info('Yazdırma tamam:', ayarlar.yaziciAdi || 'varsayılan');
              resolve({ ok: true });
            } else {
              log.error('Yazdırma hatası:', sebep);
              resolve({ ok: false, hata: sebep });
            }
          },
        );
      });
    } catch (e) {
      win.close();
      log.error('Yazıcı hata:', e.message);
      return { ok: false, hata: e.message };
    }
  });

  // Test fişi
  ipcMain.handle('yazici:test', async (_e, yaziciAdi) => {
    const html = `
      <div class="center bold xl">REBIRTH POS</div>
      <div class="center">TEST FİŞİ</div>
      <hr>
      <div>${new Date().toLocaleString('tr-TR')}</div>
      <div>Yazıcı: ${yaziciAdi || 'Varsayılan'}</div>
      <hr>
      <div class="center">Yazıcı düzgün çalışıyor!</div>
      <hr>
      <div class="center">www.rebirth.com</div>
    `;
    return ipcMain.emit('yazici:yazdir', null, html, { yaziciAdi });
  });
};
