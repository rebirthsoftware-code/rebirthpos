# Rebirth POS — Masaüstü Uygulaması

Electron tabanlı Windows/macOS/Linux uygulaması.

## Geliştirme

```bash
# Tüm sistemi başlat (backend + frontend + electron)
cd C:\xampp\htdocs\rebirth-pos
npm run dev:tum

# Veya ayrı ayrı:
npm run dev:backend     # http://localhost:3001
npm run dev:frontend    # http://localhost:3000
# Frontend hazır olunca:
npm run dev:desktop     # Electron'u aç
```

Electron geliştirme modunda `http://localhost:3000` adresini yükler — Nuxt'taki HMR aktif kalır, kod değişimleri anında yansır.

## Üretim Derlemesi

Masaüstü uygulaması **statik frontend + Electron** olarak paketlenir ve varsayılan
olarak **canlı backend'e** (`https://rebirthpos.vercel.app/api`) bağlanır — yani
kurulan uygulama, yanında ayrıca backend çalıştırmaya gerek kalmadan açılır açılmaz
çalışır (Neon veritabanına buluttan erişir). Bu varsayılan
`apps/frontend/nuxt.config.ts` içindeki masaüstü dalında tanımlıdır.

### A) GitHub Actions ile (önerilen — yerel kuruluma gerek yok)

Depoda **`.github/workflows/desktop-build.yml`** hazır. Windows runner'da `.exe`
üretir ve "Artifacts" altında indirilebilir yapar:

1. GitHub → **Actions** → **Masaüstü Uygulaması (Electron)** → **Run workflow**.
2. (Opsiyonel) Farklı bir sunucuya bağlamak için `api_base` gir (örn. `https://sirket.com/api`); boş bırakırsan canlı varsayılan kullanılır.
3. Bittiğinde **rebirth-pos-windows** artifact'ını indir → `Rebirth POS Setup x.y.z.exe`.

`v*` etiketi push'lanınca da otomatik çalışır (örn. `git tag v0.1.0 && git push --tags`).

### B) Yerel makinede

```bash
# Windows'ta: installer + portable EXE
npm run build:desktop:win

# macOS / Linux'ta (host OS'a göre dmg / AppImage)
npm run build:desktop

# Çıktı: apps/desktop/dist/
#   Rebirth POS Setup 0.1.0.exe   (NSIS installer)
#   Rebirth POS 0.1.0.exe          (portable)

# Kendi sunucunuza bağlamak için (yerel build):
#   NUXT_PUBLIC_API_BASE=https://sirket.com/api npm run build:desktop:win
```

İlk derlemede electron-builder gerekli runtime dosyalarını (~150MB) indirir. Sonraki derlemeler daha hızlıdır.

> Not: `.exe` yalnızca Windows üzerinde (veya Windows runner'da) üretilebilir; Linux/mac'te
> wine olmadan Windows hedefi alınamaz. Bu yüzden A şıkkı (Actions) en pratik yoldur.

## Yapı

```
apps/desktop/
├── main.js          Ana süreç — pencere yönetimi, IPC
├── preload.js       Renderer'a window.rebirth köprüsü
├── yazici.js        Yazıcı API'si (sistem + termal)
├── package.json     Electron + electron-builder konfig
└── assets/          icon.ico (Windows), icon.icns (mac), icon.png (linux)
```

## Frontend'den Native Erişim

```ts
const { mevcut, yazici, ayar, pencere } = useElectron();

// Electron'da mıyız?
if (mevcut.value) {
  const yazicilar = await yazici.liste();
  await yazici.yazdir('<h1>FİŞ</h1>...', { yaziciAdi: 'EPSON TM-T20' });
  await pencere.tamEkran();
  await ayar.kaydet('tema', 'koyu');
}
```

Tarayıcıda `mevcut === false` döner — kod hem web hem masaüstüne uyumlu.

## Özellikler

- ✅ Tek sürüm pencere kilidi (ikinci açışta mevcut pencere öne gelir)
- ✅ Pencere boyutu/konumu hatırlanır
- ✅ Tam ekran (F11) + tray ikonu
- ✅ Otomatik güncelleme altyapısı hazır (`electron-updater`)
- ✅ Yerel ayar dosyası (`electron-store`)
- ✅ Sistem yazıcı listesi + HTML/PDF yazdırma
- 🔲 ESC/POS termal yazıcı (sonraki sürüm)
- 🔲 ÖKC köprüsü (Beko / Ingenico — sonraki sürüm)

## İkonlar

Build için `assets/` altına ekle:
- `icon.ico` — Windows (256×256 multi-resolution)
- `icon.icns` — macOS (1024×1024)
- `icon.png` — Linux (512×512)

Geçici olarak boş bırakılabilir; build sırasında uyarı verir ama çalışır.

## Sorun Giderme

**"electron-builder yapılandırma okunamadı"** — kök `node_modules` ile çakışma. Çözüm:
```bash
cd apps/desktop && npm install --install-strategy=nested
```

**"Geliştirme sunucusu çalışmıyor"** — Önce `npm run dev:frontend` ile Nuxt'u başlat, sonra `npm run dev:desktop`.

**Build çok büyük (~200MB)** — Normal. Electron + Chromium + Node runtime'ı içerir. Tauri'ye geçince ~15MB olur (Rust kurulumu gerekir).
