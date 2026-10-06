# Colombia Coffee · Anı Duvarı (Next.js)

Misafirler kafede yaşadıkları anı (fotoğraf, video, sesli not, not) bırakır; hepsi herkese açık **Anı Duvarı**'nda görünür.
Kafedeki TV'de slayt olarak döner, masalardaki QR kartıyla herkes katılabilir.

Next.js 16 · React 19 · PostgreSQL · Vercel Blob (ya da yerel disk)

## Sayfalar

| Adres | Ne yapar |
|---|---|
| `/` | **Anı Bırak**: fotoğraf çek / galeriden seç / video çek (sürükle-bırak da olur), canlı dalgalı ses kaydı, el yazısı not, isim. Yüklenirken fincan dolar, dosya başına ilerleme görünür, iptal edilebilir. |
| `/duvar` | **Anı Duvarı**: polaroid kartlar, filtre (fotoğraf/video/ses/not), ☕ 🌿 ❤️ 😍 tepkileri, özel ses oynatıcı, kaydırarak geçilen tam ekran görüntüleyici, sonsuz kaydırma, **canlı akış** (yeni anılar 10 sn'de bir gelir). |
| `/ekran` | **TV modu**: polaroid slayt, Ken Burns efekti, videolar oynar, yeni gelen anı hemen "Yeni" etiketiyle gösterilir, köşede paylaşım QR'ı ve saat. Çift tıkla tam ekran. |
| `/yonetim` | Şifreyle giriş. Yayınla / gizle / kalıcı sil (dosyalar da silinir), "yayından önce onay iste", istatistikler, masa QR kartı yazdırma. |

## PHP sürümüne göre farklar

- **Fotoğraflar tarayıcıda küçültülür** (en uzun kenar 2000 px). Kafe Wi-Fi'ında 10 kat daha hızlı yüklenir; konum (GPS) dahil EXIF bilgisi daha telefondan çıkmadan silinir.
- **Videolar doğrudan depoya yüklenir** (Vercel Blob). Büyük videolar sunucu sınırına takılmaz; kapak karesi tarayıcıda çıkarılır.
- Emoji tepkileri (geri alınabilir), canlı akış, özel ses oynatıcı, kamera ile doğrudan çekim, sürükle-bırak.
- Fontlar uygulamanın kendisinden sunulur, QR kodlar sunucuda üretilir: dış CDN'e bağımlılık yok.

## Kurulum — Vercel (önerilen)

1. Bu klasörü Vercel'de yeni proje olarak içe aktar (Root Directory: `colombia-coffee-next`).
2. **Storage → Postgres (Neon)** ekle → `DATABASE_URL` otomatik gelir. (Rebirth POS'un Neon hesabında ayrı bir veritabanı da olur.)
3. **Storage → Blob** ekle → `BLOB_READ_WRITE_TOKEN` otomatik gelir.
4. Ortam değişkenleri: `YONETICI_SIFRE`, `OTURUM_SIRRI` (uzun rastgele metin), istersen `MEKAN_KONUM`, `MEKAN_INSTAGRAM`.
5. Deploy. Tablolar ilk istekte kendiliğinden oluşur.

## Kurulum — kendi sunucun (VPS)

```bash
cp .env.example .env.local     # DATABASE_URL, YONETICI_SIFRE, OTURUM_SIRRI doldur; BLOB_READ_WRITE_TOKEN boş kalsın
npm install
npm run build && npm start     # http://localhost:3100
```

Blob token'ı yoksa dosyalar `YUKLEME_KLASORU`'na yazılır ve `/medya/...` adresinden (video için Range destekli) sunulur.

## Güvenlik

- Yerel yüklemede dosya türü **içerikten** (ilk baytlardan) belirlenir; Blob'da yükleme izni tür ve boyutla sınırlı, kısa ömürlü token ile verilir.
- Anı kaydında gelen dosya adreslerinin gerçekten bu sitenin deposuna ait olduğu doğrulanır.
- Cihaz + IP özetine göre saatlik gönderi sınırı, bot tuzağı, yönetim girişinde deneme sınırı. IP adresi açık saklanmaz.
- Yönetim oturumu HMAC imzalı, `httpOnly` çerezle tutulur; tüm yönetim işlemleri sunucuda yetki kontrolü yapar.
