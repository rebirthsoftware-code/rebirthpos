/**
 * Rebirth POS — Electron Ana Süreç
 *
 * - Geliştirmede: http://localhost:3000 (Nuxt dev sunucusu)
 * - Üretimde: apps/frontend/.output/public/index.html (statik build)
 *
 * Yerel donanım köprüleri (yazıcı, ÖKC vs.) `yazici.js` ve `preload.js`
 * üzerinden sağlanır.
 */
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen, Tray, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const Store = require('electron-store');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_URL = 'http://localhost:3000';

// Ayarlar dosyası (~/AppData/Roaming/rebirth-pos/config.json)
const store = new Store({
  name: 'config',
  defaults: {
    bounds: { width: 1440, height: 900 },
    fullscreen: false,
    yaziciAyarlari: {
      varsayilan: null,
      kasaYazici: null,
      mutfakYazici: null,
    },
    sunucuUrl: 'http://localhost:3001',
  },
});

log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'warn';
log.info(`Rebirth POS başlatılıyor — ${isDev ? 'GELİŞTİRME' : 'ÜRETİM'}`);

let mainWindow = null;
let tray = null;

function pencereOlustur() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const bounds = store.get('bounds');

  mainWindow = new BrowserWindow({
    width: Math.min(bounds.width, width),
    height: Math.min(bounds.height, height),
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#050505',
    title: 'Rebirth POS',
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: false,
    },
  });

  if (store.get('fullscreen')) {
    mainWindow.setFullScreen(true);
  }

  // Pencere konumunu kaydet
  mainWindow.on('close', () => {
    if (!mainWindow.isFullScreen()) {
      const b = mainWindow.getBounds();
      store.set('bounds', { width: b.width, height: b.height });
    }
    store.set('fullscreen', mainWindow.isFullScreen());
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Yeni sekme yerine harici tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // URL yükle
  if (isDev) {
    mainWindow.loadURL(DEV_URL).catch((err) => {
      log.error('Dev sunucusuna bağlanılamadı:', err.message);
      dialog.showErrorBox(
        'Bağlantı Hatası',
        `Geliştirme sunucusu çalışmıyor (${DEV_URL}).\n\nÖnce "npm run dev:frontend" komutunu çalıştır.`,
      );
    });
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', '.output', 'public', 'index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      log.error('Statik dosya yüklenemedi:', err.message);
    });
  }

  // Klavye kısayolu: F11 tam ekran, Ctrl+Shift+I DevTools (dev'de zaten açık)
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      e.preventDefault();
    }
  });

  // Crash yönetimi
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    log.error('Render süreci öldü:', details);
    dialog.showErrorBox(
      'Uygulama hatası',
      `Bir hata oluştu (${details.reason}). Uygulama yeniden başlatılacak.`,
    );
    mainWindow.reload();
  });
}

function trayOlustur() {
  const ikon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
  try {
    tray = new Tray(ikon.isEmpty() ? nativeImage.createEmpty() : ikon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Rebirth POS');
    const menu = Menu.buildFromTemplate([
      { label: 'Göster', click: () => mainWindow?.show() },
      { label: 'Tam Ekran', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
      { type: 'separator' },
      { label: 'Çıkış', click: () => { app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => mainWindow?.show());
  } catch (e) {
    log.warn('Tray oluşturulamadı:', e.message);
  }
}

// ─── IPC Köprüleri (preload.js ile eşleşir) ───

ipcMain.handle('ayar:al', (_e, anahtar) => store.get(anahtar));
ipcMain.handle('ayar:kaydet', (_e, anahtar, deger) => {
  store.set(anahtar, deger);
  return true;
});

ipcMain.handle('uygulama:bilgi', () => ({
  versiyon: app.getVersion(),
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
}));

ipcMain.handle('pencere:tam-ekran', () => {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

ipcMain.handle('pencere:kucuk', () => mainWindow?.minimize());
ipcMain.handle('pencere:kapat', () => mainWindow?.close());

// Yazıcı işlemleri
try {
  require('./yazici')(ipcMain, log);
} catch (e) {
  log.warn('Yazıcı modülü yüklenemedi (sistem yazıcıları çalışır):', e.message);
}

// ─── Uygulama yaşam döngüsü ───

// Tek instance — ikinci açıldığında pencereyi öne getir
const tekInstance = app.requestSingleInstanceLock();
if (!tekInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  pencereOlustur();
  trayOlustur();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) pencereOlustur();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// İçerikte yeni yüklenen URL'i kısıtla (güvenlik)
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith(DEV_URL)) return;
    if (!isDev && url.startsWith('file://')) return;
    log.warn('Yasak navigasyon engellendi:', url);
    event.preventDefault();
  });
});
