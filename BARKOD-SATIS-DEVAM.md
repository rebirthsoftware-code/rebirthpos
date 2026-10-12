# Barkodlu Stok & Satış Sistemi — Devam Notu

> Bu dosya, barkodlu satış sistemi çalışmasını **yeni bir sohbette** kaldığı yerden sürdürmek için yazıldı.
> Yeni oturum önce bu dosyayı okumalı.

**Tarih:** 12 Ekim 2026
**Branch:** `claude/barcode-inventory-sales-system-qi2qh0` (repo: `rebirthsoftware-code/rebirthpos`)

---

## 1. Karar

Barkodlu stok ve satış sistemi **Rebirth POS'un parçası olmayacak.**
Kendi sayfası / uygulaması olan **ayrı bir ürün** olarak geliştirilecek.

Bu yüzden:

- POS'a yapılmış barkod entegrasyonu (aşağıda, bölüm 3) **geri alınacak.**
- Geliştirme, zaten var olan bağımsız sürüm (`barkod-stok/`) üzerinden ya da onun yerine yazılacak yeni bir uygulamayla devam edecek (bölüm 5'teki sorulara göre).

## 2. İstenen sistem (kullanıcının ilk isteği)

> Malzemelere barkod basıp hem stok girişi hem de satarken stok çıkışı yapılacak; yani satış sistemi de olacak.
> Fiyatların göründüğü, elimde kaç tane olduğunun göründüğü bir sistem istiyorum. Farklı bir klasör açarak yapalım.

Özetle:

- Ürünlere **barkod etiketi basma** (fiyatlı)
- Barkod okutarak **stok girişi**
- Barkod okutarak **satış**: satışta stok otomatik düşer
- Her ürünün **fiyatı** ve **eldeki adedi** her ekranda görünür

## 3. Geri alınacak: POS entegrasyonu

İki commit barkod özelliklerini POS'un içine ekledi:

| Commit | Ne yaptı |
|---|---|
| `c205f97` | Barkodlu stok & satışı ana projeye entegre et |
| `b6ce671` | Ürünlere barkod ekleme (kartta "Barkod ekle", barkodsuz ürünlere toplu barkod) |

**Dokunulan POS dosyaları:**

- Backend
  - `apps/backend/src/urunler/` (`urunler.controller.ts`, `urunler.service.ts`, `dto/urun.dto.ts`)
    - Eklenen uçlar: `GET /urunler/barkod/:barkod`, `GET /urunler/yeni-barkod`, `POST /urunler/barkodsuzlara-uret`
    - Barkod çakışma kontrolü
    - DTO'ya `stokBirim` ve `stokUyariEsigi` alanları
  - `apps/backend/src/stok/` (`stok.controller.ts`, `stok.service.ts`, `dto/stok.dto.ts`)
    - Eklenen uç: `POST /stok/toplu-hareket`
- Frontend
  - Yeni dosyalar: `pages/etiket.vue`, `composables/useEtiket.ts`, `utils/barkod.ts`
  - Değişenler: `pages/stok.vue` ("Barkodla İşlem" sekmesi), `pages/hizli.vue` (barkodla satış), `pages/urunler.vue` (barkod ekle/üret), `components/AppSidebar.vue` ("Barkod Etiketi" menüsü)
- `DURUM.md`: "Barkodlu Stok & Satış (entegrasyon)" bölümü

**Nasıl geri alınır (denendi, çakışmasız uygulanıyor):**

```bash
git revert --no-edit b6ce671 c205f97
```

Veritabanı şeması değişmediği için geri almada migration gerekmiyor.

> ⚠️ **Geri ALINMAYACAK iki POS düzeltmesi** (POS için gerekli, barkodla ilgisi yok):
> - `f28b5d6`: Vercel backend fonksiyonu `nodejs20.x` → `nodejs22.x`. Bu olmadan Vercel yayınları başarısız oluyor (`scripts/build-vercel.mjs`).
> - `c5d31c6`: `.vercelignore`, POS dışındaki klasörleri POS yayınından çıkarıyor. Yeni barkod uygulaması repoda ayrı bir klasöre konursa o klasör de buraya eklenmeli.

## 4. Elde olan: bağımsız sürüm `barkod-stok/`

POS'tan tamamen ayrı, **ek paket gerektirmeyen** çalışan bir sürüm var.

- **Teknoloji:** Node.js 22.5+ (dahili `node:sqlite`), saf HTML/CSS/JS arayüz.
- **Çalıştırma:** `cd barkod-stok && npm start` → http://localhost:4100 (Windows: `baslat.bat`).
- **Veri:** `barkod-stok/veri/barkod-stok.db` (git'e girmez).
- **Canlı demo** (sunucusuz, veriler tarayıcıda): https://claude.ai/artifact/KkHyCmj7QZrVw6axA3HW16
  - Demo dosyasını yeniden üretmek için: `node barkod-stok/demo/olustur.js`

### Ekranlar

| Ekran | İşlev |
|---|---|
| Satış (F1) | Barkod okut → sepet. Fiyat ve eldeki stok görünür. `3*barkod` = 3 adet. İskonto, nakit/kart/diğer, para üstü. F9 ile tamamla → stok düşer. |
| Stok Giriş / Çıkış (F2) | Giriş (mal kabul), çıkış (fire/zayi), sayım. Tanımsız barkodda yeni ürün formu. "Sonra etiket bas". |
| Ürünler & Stok (F3) | Alış/satış fiyatı, eldeki adet, kritik stok, stok değeri, CSV dışa aktarma. |
| Barkod Etiketi Bas (F4) | Rulo etiket yazıcısı (ör. 50×30 mm) veya A4 ızgara. Ad + barkod + fiyat. |
| Satışlar | Tarih aralığı, ciro/nakit/kart, fiş detayı, fiş yazdırma, satış iptali (stok geri eklenir). |
| Stok Hareketleri | Her giriş/satış/çıkış/iade/sayım; önceki → sonraki stok. |
| Özet | Günlük ciro, stok değeri, kritik stoklar, en çok satanlar. |
| Ayarlar | İşletme adı, fiş yazıları, otomatik fiş, eksi stoğa satış izni. |

### Barkod

- Ürünün kendi barkodu (ör. `869…` EAN-13) okutularak kullanılır.
- Barkodu olmayan ürüne `2` ile başlayan **mağaza içi EAN-13** üretilir; GS1'in iç kullanım aralığı, üretici barkodlarıyla çakışmaz.
- Çizim: geçerli 13 hane → EAN-13, diğerleri → Code128. Kod `barkod-stok/public/barkod.js` içinde, harici kütüphane yok.
- USB/Bluetooth okuyucular klavye gibi çalışır (kod + Enter).

### Dosyalar

```
barkod-stok/
├── server.js          HTTP sunucu + REST API (≈380 satır)
├── db.js              SQLite şeması: urunler, hareketler, satislar, satis_kalemleri, ayarlar
├── baslat.bat         Windows başlatıcı
├── package.json       "start": "node --no-warnings server.js" (bağımlılık yok)
├── public/
│   ├── index.html
│   ├── app.js         Tüm arayüz (≈1000 satır)
│   ├── barkod.js      EAN-13 / Code128 → SVG
│   └── style.css
└── demo/
    ├── demo-api.js    Tarayıcı içi sahte API (localStorage)
    ├── olustur.js     Tek dosyalık demo üretir
    └── barkod-stok-demo.html
```

### API (server.js)

| Uç | Açıklama |
|---|---|
| `GET /api/urunler?ara=&kritik=1` | Ürün listesi |
| `GET /api/urunler/barkod/:barkod` | Barkodla ürün |
| `GET /api/yeni-barkod` | Mağaza içi EAN-13 üret |
| `POST /api/urunler`, `PUT /api/urunler/:id`, `DELETE /api/urunler/:id` | Ürün ekle/düzenle/pasife al |
| `POST /api/stok-hareket` | `{tip: GIRIS\|CIKIS\|SAYIM, kalemler:[{urun_id, miktar, birim_fiyat?}], aciklama, alisFiyatGuncelle, eksiyeIzinVer}` |
| `GET /api/hareketler?urun_id=&tip=&bas=&bit=` | Stok hareketleri |
| `POST /api/satislar` | `{kalemler, odeme_tipi, alinan, iskonto, eksiyeIzinVer}` → stok düşer |
| `GET /api/satislar`, `GET /api/satislar/:id`, `POST /api/satislar/:id/iptal` | Satış listesi / detay / iptal |
| `GET /api/ozet`, `GET/PUT /api/ayarlar` | Günlük özet, ayarlar |

### Test edilenler

API uçtan uca (curl) ve tarayıcıda (Playwright) denendi:

- Satış, para üstü, yetersiz stok uyarısı
- Tanımsız barkoddan ürün tanımlama
- Etiket PDF çıktısı: rulo modunda her etiket ayrı sayfa (50×30 mm), A4 modunda ızgara
- Satış iptali ve sayım

**Henüz yapılmadı:** gerçek bir barkod okuyucu ve etiket yazıcısıyla fiziksel test.

### Bilinen sınırlar

- Tek kullanıcılı; giriş/yetki sistemi yok.
- SQLite yerel dosya: tek bilgisayar ya da yerel ağ için uygun. Vercel gibi sunucusuz ortamda çalışmaz; orada PostgreSQL gerekir.
- Çoklu mağaza/şube desteği yok.

## 5. Yeni sohbette netleştirilecek sorular

1. **"Ayrı sayfa" ne olacak?**
   - (a) `barkod-stok/` olduğu gibi geliştirilir; kafede/mağazada bir bilgisayarda çalışır (en hızlı).
   - (b) İnternetten erişilen ayrı bir web uygulaması olur (ör. Next.js + PostgreSQL/Neon, Vercel'de kendi projesi). `colombia-coffee-next/` bu yapının bir örneği.
   - (c) Aynı repoda mı, ayrı bir repoda mı duracak?
2. **Kimler kullanacak?** Tek kasa mı, birden fazla kullanıcı/rol mü (giriş gerekli mi)?
3. **Tek mağaza mı, birden fazla mağaza mı?**
4. **Donanım:** Hangi barkod okuyucu ve etiket yazıcısı (marka/model, etiket ölçüsü)? Fiş yazıcısı var mı?
5. **Ek ihtiyaçlar:** Tedarikçi, alış faturası, kâr raporu, KDV, Excel'den toplu ürün aktarma vb. isteniyor mu?
6. POS'taki entegrasyon (bölüm 3) yeni sohbette ilk iş olarak geri alınsın mı?

## 6. Aynı branch'teki diğer çalışmalar (barkodla ilgisi yok)

Bu branch'te ayrıca şunlar var; yeni barkod çalışması için **yeni bir branch** açılması önerilir:

- `colombia-coffee-ani/`: Colombia Coffee Anı Duvarı (PHP)
- `colombia-coffee-next/`: Colombia Coffee Anı Duvarı (Next.js) + `sunum/` tanıtım PDF'i
- POS Vercel düzeltmeleri (`f28b5d6`, `c5d31c6`)

## 7. Yeni sohbet için başlangıç mesajı (kopyala-yapıştır)

```
rebirthpos reposunda BARKOD-SATIS-DEVAM.md dosyasını oku.
Barkodlu stok & satış sistemi POS'un parçası olmayacak, ayrı bir uygulama olacak.
Önce POS'taki barkod entegrasyonunu geri al (dosyadaki 3. bölüm), sonra 5. bölümdeki
sorulara göre ayrı uygulamayı birlikte planlayalım.
```
