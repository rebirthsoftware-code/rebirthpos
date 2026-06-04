# Rebirth POS — Durum & Yol Haritası

**Son güncelleme:** 2026-05-13 (gece geç)
**Mevcut sürüm:** 0.8.1 (Faz 8.6 kusursuzluk sertleştirmesi BAŞLANDI — yarıda kaldı)

> Bu dosya **"şu an neredeyiz, sırada ne var"** sorusunu tek bakışta cevaplar.
> Yeni bir Claude oturumu açtığında ilk burayı okusun.

---

## 🟢 Tamamlanmış

### Faz 0 — Proje İskeleti
- ✅ Monorepo (npm workspaces): `apps/backend`, `apps/frontend`, `apps/desktop`
- ✅ Backend: NestJS 10 + TypeScript + Prisma 5 + SQLite (dev) / PostgreSQL (prod)
- ✅ Frontend: Nuxt 3 + Vue 3 + Tailwind + Pinia
- ✅ Auth: JWT (access + refresh) + rol-yetki sistemi
- ✅ DB şeması: 14 tablo, multi-tenant `subeId` mimarisi

### Faz 1 — Temel CRUD
- ✅ Firmalar, Şubeler (sadece super admin / firma admin)
- ✅ Kategoriler (renk + ikon seçimli)
- ✅ Ürünler (kategori filtreli, KDV, stok takip flag, QR menü flag)
- ✅ Katlar + Masalar (renk-bazlı durum kartları)

### Faz 2 — POS Akışı
- ✅ Adisyon: açma, kapatma, listeleme, otomatik numaralama (A-YYYYMMDD-NNNN)
- ✅ Sipariş kalemleri: ekleme, kalem iptali, durum geçişleri
- ✅ Ödeme: 4 tip (Nakit/KK/Yemeksepeti/Yemek Çeki), kısmi ödeme
- ✅ KDV dahil fiyattan KDV çıkarımı, iskonto, bahşiş
- ✅ Masa tıklayınca otomatik adisyon aç/var olana git

### Faz 3 — Realtime + QR
- ✅ WebSocket Gateway (Socket.IO), şube odası yayını
- ✅ Mutfak ekranı (KDS): 3 sütun (Yeni/Hazırlanıyor/Hazır), bip sesi, drag animasyonu
- ✅ Public QR menü (`/qr/[subeId]`), mobil-first, sepet drawer
- ✅ Tüm sayfalarda anlık güncelleme (siparis/adisyon/odeme/masa olayları)

### Faz 4 — Tam Yönetim
- ✅ Personel (Kullanıcılar) CRUD + şubeye atama + 7 rol
- ✅ Müşteriler CRUD + telefonla hızlı arama + geçmiş adisyon
- ✅ Paket servis (PAKET/GEL_AL), kurye atama, durum akışı
- ✅ Stok: durum + hareket geçmişi, otomatik satış düşümü
- ✅ Raporlar: günsonu, KPI'lar, saatlik grafik, en çok satanlar, personel performans

### Faz 5 — Hızlı Sipariş + Toast
- ✅ /hizli sayfası (tezgah satışı, para üstü)
- ✅ Toast bildirim sistemi (alert yerine)
- ✅ Skeleton loader, login cilası, sidebar gruplandırma

### Faz 6 — Gelişmiş Ödeme Ekranı
- ✅ 4 sekmeli ödeme: Tam Tutar / Ürün Seç / Eşit Böl / Karma
- ✅ Tam ekran tasarımlı `AppOdemeEkrani.vue` komponenti
- ✅ Para üstü, yuvarlama (₺1/5/10), bahşiş %

### Faz 7 — Tasarım Sistemi Yenilemesi
- ✅ Siyah/altın/beyaz palette (ink/pearl/gold tokenları)
- ✅ Menulux-tarzı 3 panel layout (sol aksiyon + orta içerik + sağ kategori)
- ✅ Hero banner, pos-module-card, table-card durum renkleri
- ✅ `AppActionBar` komponenti
- ✅ Dashboard yenilendi (selamlama + saat + modül grid)
- ✅ Masalar sayfası: aktif adisyon listesi + masa grid + kat sekmeleri
- ✅ Adisyon detay: sol aksiyon + adisyon listesi + ÖDEME AL + ürün grid + kategori sekmeleri

### Faz 8 — Masaüstü Uygulaması
- ✅ Electron 32 kurulumu (`apps/desktop/`)
- ✅ Main process (pencere, IPC, güvenlik, tek instance, tray)
- ✅ Preload köprüsü → frontend'de `window.rebirth`
- ✅ Yazıcı bridge (sistem yazıcısı listesi + HTML yazdırma)
- ✅ `useElectron()` composable — hem web hem desktop uyumlu
- ✅ Nuxt static build config (DESKTOP_BUILD env ile)
- ✅ electron-builder Windows NSIS + portable EXE konfig

### Faz 8.5 — Güvenlik & Veri Bütünlüğü Sertleştirmesi
ÖKC öncesi yapılması zorunlu altyapı temizliği. Her madde test'le (37+30+15+15+9 = 100+ assertion) doğrulandı.

- ✅ **KDV hesaplama bug fix** ([adisyon-hesap.ts](apps/backend/src/adisyonlar/adisyon-hesap.ts)): iskonto sonrası KDV doğru hesaplanır. Çoklu KDV oran dökümü (`kdvDokumu`) hesaplamadan üretilir.
- ✅ **Ödeme transactional**: `odeme.create + adisyon.update + masa.update` tek `$transaction`'da. Yarım state imkansız. Realtime emit'leri transaction dışında.
- ✅ **Idempotency**: `Odeme.idempotencyKey` (per-adisyon unique). Çift tıklama, retry, network kesintisi çift ödeme yaratmaz. Frontend her modal/satış için UUID üretir.
- ✅ **Audit log**: `Denetim` tablosu + `DenetimService.kaydet(tx, user, …)`. 12 olay tipi: ödeme, adisyon, sipariş kalemi iptal, ürün fiyat/KDV/silme, stok düzeltme, kullanıcı rol değişimi, ÖKC fiş kesimi. `onceki/sonraki` JSON snapshot. `GET /api/denetim` (yönetici).
- ✅ **Helmet** (`/api` path-bound, Socket.IO transport'unu bozmaz)
- ✅ **Throttler** (global 100/dk, login 5/dk, refresh 20/dk, QR siparis 10/dk)
- ✅ **WebSocket auth**: handshake'de JWT zorunlu, `join` sırasında şube yetki kontrolü. Kullanıcının erişmediği şubeye reddedilir.
- ✅ **Rol guard'ları finansal endpoint'lere**: `YONETICI_ROLLER` sabiti. KASIYER ürün fiyatı değiştiremez, adisyon iptal edemez, ödeme iade edemez, rapor göremez. POS akışı (adisyon aç, sipariş ekle, ödeme al) KASIYER'e açık.
- ✅ **Refresh token hash + secret rotation**: SHA-256 hash DB'de, plaintext sadece client'ta. `jti: randomUUID()` her token'da. Rotation: her refresh eski iptal + yeni üret. `.env`'de yeni güçlü secret'lar.
- ✅ **Çoklu KDV oran şeması**: `Adisyon.kdvDokumu` JSON kolonu. Sipariş ekleme/iskonto değişimi sırasında otomatik güncellenir.

### Tasarım Birleştirme (Faz 7 finalizasyonu)
Daha önce "tema yarım" olarak listelenmişti — 184 occurrence. Detaylı incelemede çoğunluğun gerçek tutarsızlık değil, alternatif token kullanımı olduğu görüldü.

- ✅ **Token normalizasyonu**: tüm `text-gray-300/400/500/600/700` → `text-pearl-*`, `bg-white/5|10|[0.05]` → `bg-pearl-*`, `border-gray-200` → `border-pearl-10` (toplam 184 occurrence, 16 dosya). Görsel etki minimal, ama tasarım sistemine tam uyum: gelecek tema değişimleri tek tokenset'ten yönetilir.
- ✅ **Native `confirm()` modal'ı kaldırıldı**: 8 sayfada (personel, firmalar, kategoriler, urunler, masalar, subeler, adisyon detay × 2) tarayıcı dialog kullanılıyordu — koyu temada uyumsuz. Yerine:
  - `composables/useOnay.ts` — Promise-based, başlık + mesaj + tehlikeli flag
  - `components/AppOnayModal.vue` — tema uyumlu, Escape/Enter klavye desteği, kırmızı tehlikeli buton seçeneği
  - `layouts/default.vue` — global mount, her sayfa kullanır
- Layouts/default ve app.vue içindeki gri token'lar da normalize edildi.

### Faz 9 — ÖKC Entegrasyonu (Mock Evresi)
**Backend uçtan uca hazır**, gerçek Beko/Ingenico SDK gelene kadar `MockOkcAdapter` üzerinden çalışır. Adapter değişimi tek bir `OKC_MARKA` env değişikliği.

- ✅ Schema: `Adisyon.okcFisNo`, `okcFisTarihi`, `okcMarka`. `@@unique([subeId, okcFisNo])` — aynı fiş no iki kez kesilmez.
- ✅ `apps/backend/src/okc/`:
  - `okc.types.ts` — `IOkcAdapter`, `OkcFisIstegi`, `OkcFisYaniti`, `OkcKdvSatiri`
  - `mock.adapter.ts` — geliştirme + CI için, gerçek cihaz olmadan tüm akış çalışır. `MOCK-YYYYMMDD-NNNNNN` fiş no üretir, KDV tutarlılık kontrolü yapar.
  - `okc.service.ts` — `satisGonder(adisyonId, user)`:
    - Idempotency: zaten kesilmiş fiş varsa `{zatenKesildi:true}` döner
    - Önkoşul: adisyon `KAPALI` olmalı
    - Race safe: P2002 unique violation yakalanır
    - Transaction: adisyon + odeme + audit aynı anda yazılır
  - `okc.controller.ts` — `POST /api/okc/satis/:adisyonId`, `GET /api/okc/durum`. Throttle 30/dk.
  - `okc.module.ts` — `OKC_MARKA` env (MOCK | BEKO | INGENICO) ile adapter swap
- ✅ Audit olayı: `OKC_FIS_KESILDI` (fiş no, marka, toplam, KDV dökümü)
- ✅ Frontend: `AppOdemeEkrani.vue` ödeme tamamlandıktan sonra otomatik `/okc/satis/:id` çağırır. 3 durumlu overlay: üretiliyor (spinner), başarılı (fiş no büyük + KDV dökümü tablosu), hata ("tahsilat alındı, sonra dene" + retry).
- ✅ End-to-end test: 15/15 senaryo geçti.

---

## 🔵 Şu An Buradayız — Faz 8.6 KUSURSUZLUK SERTLEŞTİRMESİ (YARIM)

**Hedef:** ÖKC öncesi tüm açık kalan eksikleri kapatıp sistemi tam kusursuz hâle getirmek.
Bu faz başladı ancak ortada kesildi — kullanıcı yeni sohbete geçti. Aşağıdaki liste yeni Claude oturumunun direkt başlayacağı yer.

### ✅ Bu sürede tamamlananlar

1. **`denetim.olay.ts` 28 olaya genişletildi** ([apps/backend/src/denetim/denetim.olay.ts](apps/backend/src/denetim/denetim.olay.ts)):
   - Güvenlik: `LOGIN_BASARISIZ`
   - Müşteri: `MUSTERI_OLUSTUR`, `MUSTERI_GUNCELLE`, `MUSTERI_SIL`
   - Paket: `PAKET_OLUSTUR`, `PAKET_KURYE_ATA`, `PAKET_DURUM_DEGISTI`
   - Yapısal: `KATEGORI_*`, `KAT_*`, `MASA_*`, `FIRMA_*`, `SUBE_*` (her biri OLUSTUR/GUNCELLE/SIL)
   - ÖKC: `OKC_IADE`, `OKC_Z_RAPORU`, `OKC_X_RAPORU`

2. **Müşteriler tam kusursuz:**
   - `musteriler.module.ts` → `DenetimModule` import
   - `musteriler.service.ts` → tüm CRUD transactional + audit log (`olustur` upsert için audit dallı: var olan müşteri = GUNCELLE, yeni = OLUSTUR)
   - `musteriler.controller.ts` → `@UseGuards(JwtAuthGuard, RolesGuard)`, sil için `@Roles(...YONETICI_ROLLER)`. KASIYER artık müşteri silemez

3. **Kategoriler tam kusursuz:**
   - `kategoriler.module.ts` → `DenetimModule` import
   - `kategoriler.service.ts` → olustur/guncelle/sil transactional + audit log

4. **Katlar yarım:**
   - `katlar.module.ts` → `DenetimModule` import ✓
   - `katlar.service.ts` → audit log HENÜZ YOK ⚠

5. Backend build temiz ✓

### 🔲 Yeni oturumda hemen yapılacaklar (sırayla)

#### Backend tarafı (tahmini 40dk)

1. **Katlar service'e audit ekle** — kategoriler.service'in birebir aynı pattern'i:
   ```ts
   // imports: DenetimService + DenetimOlay
   // constructor(private denetim: DenetimService)
   // olustur/guncelle/sil → $transaction + denetim.kaydet
   // olaylar: KAT_OLUSTUR, KAT_GUNCELLE, KAT_SIL
   ```

2. **Masalar service+module** — aynı pattern (MASA_OLUSTUR/GUNCELLE/SIL)
   - module'e DenetimModule import
   - service'i transactional+audit yap

3. **Firmalar service+module** — FIRMA_OLUSTUR/GUNCELLE/SIL

4. **Şubeler service+module** — SUBE_OLUSTUR/GUNCELLE/SIL

5. **Paket service+module** — PAKET_OLUSTUR/KURYE_ATA/DURUM_DEGISTI
   - `olustur`: PAKET_OLUSTUR (kalemler özet)
   - `kuryeAta`: PAKET_KURYE_ATA (eski/yeni kurye)
   - `paketDurumGuncelle`: PAKET_DURUM_DEGISTI (eski/yeni durum)

6. **Auth service — login başarısızlık logu** ([auth.service.ts](apps/backend/src/auth/auth.service.ts)):
   - `login()` `UnauthorizedException` fırlatmadan önce `denetim.kaydet(this.prisma, null, {...})` ile LOGIN_BASARISIZ kaydet
   - Detay: denenen e-posta, IP (request'ten geçirmek gerek → `@Req()` controller'da)
   - Bunun için auth.controller'ı revize et: `@Req() req: Request` ile IP al, login service'e geçir

7. **ÖKC Z raporu + iade endpoint'leri**:
   - `IOkcAdapter`'a yeni metodlar: `zRaporu()`, `xRaporu()`, `iade(istek)`
   - `MockOkcAdapter`'da implementasyonları (Z raporu = günsonu özeti dön, iade = orijinal fiş referansıyla negatif)
   - `OkcService`: `zRaporuAl()`, `iade(odemeId)` metodları + audit (`OKC_Z_RAPORU`, `OKC_IADE`)
   - `OkcController`: `POST /api/okc/zraporu`, `POST /api/okc/iade/:odemeId`
   - Rol kontrolü: Z raporu yönetici, iade yönetici

#### Frontend tarafı (tahmini 50dk)

8. **`hizli.vue` ödeme sonrası fiş kesimi** ([pages/hizli.vue](apps/frontend/pages/hizli.vue)):
   - `satisTamamla()` sonunda — adisyon kapandıktan sonra `apiFetch('/okc/satis/${adisyon.id}', { method: 'POST' })`
   - Fiş no response'a yansısın, mevcut fiş objesi UI'da var
   - Hata olursa "tahsilat alındı, fiş sonra dene" UX'i

9. **Adisyon detay'da fiş kartı** ([pages/adisyon/[id].vue](apps/frontend/pages/adisyon/[id].vue)):
   - Adisyon `okcFisNo` doluysa: üstte altın çerçeveli kart
   - Fiş no (büyük mono font), tarih, marka, KDV dökümü tablosu (kdvDokumu parse)
   - Eğer adisyon KAPALI ama `okcFisNo` yoksa → "Fiş kesilmedi" uyarısı + manuel `[Fiş Kes]` butonu

10. **`/denetim` sayfası** (yeni `pages/denetim.vue`):
    - Yönetici-only (middleware veya server-side kontrol)
    - Filtre: tarih aralığı, olay tipi (`DenetimOlay` listesinden), kullanıcı, entityTipi
    - Tablo: tarih · kullanıcı · olay · özet · entity (linkleme adisyon/ürün vb.)
    - Detay tıklayınca: `onceki/sonraki` JSON snapshot side-by-side gösterim

11. **`/ayarlar/okc` sayfası** (yeni `pages/ayarlar/okc.vue`):
    - `/api/okc/durum` çağırarak adapter marka + bağlı durumu göster
    - `[Test Et]` butonu (mock için trivial başarılı dönecek)
    - `[Z Raporu Al]` butonu (yönetici, sonuç modal'da göster)
    - `OKC_MARKA` env değişikliği hatırlatması (frontend'den env değiştirilmez, açıklama notu yeter)

12. **Sidebar güncelle** ([components/AppSidebar.vue](apps/frontend/components/AppSidebar.vue)):
    - "Yönetim" grubu altına "Denetim" linki (yönetici görür)
    - "Ayarlar" grubu açıp altına "ÖKC" linki ekle

#### Doğrulama

13. **Build + entegrasyon testi:**
    - `npm --workspace apps/backend run build`
    - `npm --workspace apps/frontend run build`
    - Hızlı E2E: KASIYER + müşteri sil reddi, login fail audit, ÖKC iade akışı

14. **DURUM.md final güncelleme** — sürümü 0.9'a yükselt, "🔵 Şu An Buradayız" → "Gerçek ÖKC SDK temini"

### Yeni oturumun açılış komutu

```
DURUM.md'yi oku. Faz 8.6 yarım kalmış — yeni oturumda hemen yapılacaklar
listesinin 1. maddesinden başla. Katlar service'e audit log ekle, sonra
sırayla Masalar/Firmalar/Şubeler/Paket'e devam et. Pattern olarak
kategoriler.service.ts'i kullan. Her servis bittiğinde `npm --workspace
apps/backend run build` ile temiz olduğunu doğrula. Frontend kısmına
geçince hizli.vue → adisyon detay → denetim → ayarlar/okc sırasıyla git.
```

---

## 🟡 Önceki "Şu An Buradayız" notu (referans)

Faz 8.6 başlamadan önce sırada iki paralel iş vardı:
1. ~~Tasarım birleştirme~~ ✅ TAMAM (token normalize + AppOnayModal)
2. **Gerçek ÖKC SDK entegrasyonu** (Beko + Ingenico, .NET 8 agent — iş tarafı SDK temini)

---

## 🟡 Faz 9 — Geriye Kalan: Gerçek ÖKC Cihaz Entegrasyonu

Backend ve frontend tarafı **MockOkcAdapter** üzerinden çalışır durumda. Aşağıdaki adımlar gerçek cihaz desteğinin geri kalanı.

### Hedef
Türkiye'de zorunlu olan Ödeme Kaydedici Cihaz (ÖKC) entegrasyonu. Beko ve Ingenico marka cihazlarla GMP-3 protokolü üzerinden iletişim.

### Mimari Karar — "ÖKC Aracı Servisi"

Doğrudan Electron'dan ÖKC'ye konuşmak yerine **ayrı bir yerel servis** koyacağız:

```
[Tauri/Electron POS]
        │ HTTP REST
        ▼
[ÖKC Aracı Servisi]  ← Yeni .NET 8 console app, Windows service olarak çalışır
        │ TCP/Serial GMP-3
        ▼
[ÖKC cihazı: Beko 300TR / Ingenico iWL250]
```

**Neden ayrı servis:**
- Beko/Ingenico SDK'ları çoğunlukla .NET tabanlı, Node'dan doğrudan çağrılması zor
- Servis tek noktadan birden çok POS terminalini destekleyebilir (1 ÖKC, 3 kasa)
- POS yazılımını ÖKC marka değişiminden bağımsızlaştırır (sadece servis değişir)
- Crash'lerden POS etkilenmez (servis ayrı süreçte)

### Yeni Dizin Yapısı (eklenecek)

```
rebirth-pos/
├── apps/
│   ├── backend/
│   ├── frontend/
│   ├── desktop/
│   └── okc-agent/            ← YENİ — .NET 8 console app
│       ├── Program.cs
│       ├── Controllers/      → HTTP API endpoints
│       ├── Adapters/
│       │   ├── BekoAdapter.cs       (Hugin SDK / GMP-3)
│       │   ├── IngenicoAdapter.cs   (Ingenico SDK / GMP-3)
│       │   └── IOkcAdapter.cs       → arayüz
│       ├── Models/
│       │   ├── SatisIstegi.cs
│       │   ├── FisYaniti.cs
│       │   └── ZRaporu.cs
│       └── okc-agent.csproj
```

### ÖKC Agent API (HTTP, localhost:7600)

| Endpoint | Açıklama |
|---|---|
| `GET  /durum` | Cihaz bağlı mı, marka, model, son hata |
| `POST /satis` | Satış kaydet → fiş üret. Body: `{adisyonId, kalemler[], odemeler[], kdv[]}` |
| `POST /iade` | İade işlemi |
| `POST /z-raporu` | Günsonu (Z) raporu |
| `POST /x-raporu` | Ara (X) raporu |
| `GET  /fis/:no` | Önceden çıkarılmış fişi sorgula |
| `POST /test` | Cihazla iletişim testi |

### Backend → Agent Köprüsü

```ts
// apps/backend/src/okc/okc.service.ts (eklenecek)
@Injectable()
export class OkcService {
  private readonly agentUrl = 'http://localhost:7600';

  async satisGonder(adisyonId: string) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: { siparisler: { include: { kalemler: { include: { urun: true } } } }, odemeler: true },
    });

    // ÖKC formatına dönüştür
    const istek = {
      kalemler: adisyon.siparisler.flatMap(s => s.kalemler.map(k => ({
        ad: k.urun.ad, adet: k.adet, fiyat: Number(k.birimFiyat), kdv: Number(k.urun.kdvOrani),
      }))),
      odemeler: adisyon.odemeler.map(o => ({ tip: o.tip, tutar: Number(o.tutar) })),
    };

    const yanit = await fetch(`${this.agentUrl}/satis`, {
      method: 'POST', body: JSON.stringify(istek),
      headers: { 'Content-Type': 'application/json' },
    });
    const fis = await yanit.json();

    // Fiş numarasını adisyon ödemesine kaydet
    await this.prisma.odeme.updateMany({
      where: { adisyonId, iptal: false },
      data: { okcFisNo: fis.fisNo },
    });

    return fis;
  }
}
```

### Frontend Akışı

Ödeme tamamlanınca toast/modal:
```
✓ Ödeme alındı
↓
Otomatik /api/okc/satis çağrısı → Agent → ÖKC
↓
✓ Fiş üretildi · No: 00012345
[Yazdır] [Tamam]
```

### Görev Listesi (sıralı adımlar)

> Yapıldı (✅) → mock ile uçtan uca çalışıyor.
> Açık (⬜) → gerçek SDK + cihaz temini gerek.

1. **Beko SDK temini** ⬜
   - [ ] Beko bayisi/dağıtıcısı ile entegrasyon sözleşmesi
   - [ ] Hugin SDK dokümantasyonunu al (NDA imzalama gerekebilir)
   - [ ] Test cihazı temin et (gerçek satış GİB'e gider — test modu şart!)

2. **Ingenico SDK temini** ⬜
   - [ ] Ingenico Türkiye veya Pavo Bayisi ile iletişim
   - [ ] Ingenico OKC SDK (.NET) edinme
   - [ ] Test cihazı

3. **.NET ortamı kurulumu** ⬜
   - [ ] .NET 8 SDK kur (`dotnet --version` ile doğrula)
   - [ ] `apps/okc-agent` projesi oluştur: `dotnet new webapi -n okc-agent`
   - [ ] Windows Service paketleme: `Microsoft.Extensions.Hosting.WindowsServices` NuGet

4. **Mock Adapter** ✅
   - [x] `MockOkcAdapter` (TypeScript, `apps/backend/src/okc/mock.adapter.ts`)
   - [x] Backend entegrasyonu uçtan uca test edildi (15/15)
   - NOT: .NET agent gelince TS mock kalır (CI/test için), production'da swap edilir

5. **Backend OKC modülü** ✅
   - [x] `apps/backend/src/okc/` → types, mock adapter, service, controller, module
   - [x] `POST /api/okc/satis/:adisyonId` — idempotent fiş kesimi
   - [x] `GET /api/okc/durum` — adapter durumu
   - [x] Audit: `OKC_FIS_KESILDI` olayı tam snapshot ile loglanır
   - [ ] `POST /api/okc/zraporu` (günsonu Z raporu) — adapter eklenince
   - [ ] `POST /api/okc/iade` — iade işlemi

6. **Frontend OKC UI** ✅
   - [x] `AppOdemeEkrani.vue` ödeme sonrası otomatik fiş kesimi
   - [x] 3 durumlu overlay (üretiliyor / başarılı + KDV dökümü / hata + retry)
   - [ ] Ayarlar > ÖKC sayfası: bağlantı durumu, test butonu, marka seçimi
   - [ ] Adisyon detay sayfasında fiş no gösterimi (eski adisyonlar için)

7. **Beko gerçek entegrasyon** ⬜
   - [ ] `apps/okc-agent/Adapters/BekoAdapter.cs` — Hugin SDK native call'ları
   - [ ] Test cihazı ile uçtan uca: satış → fiş → Z raporu

8. **Ingenico gerçek entegrasyon** ⬜
   - [ ] `apps/okc-agent/Adapters/IngenicoAdapter.cs` — Ingenico SDK
   - [ ] Test cihazı ile aynı akış

9. **Konfigürasyon** ✅ kısmen
   - [x] `OKC_MARKA` env (MOCK/BEKO/INGENICO) — TS adapter factory
   - [ ] .NET agent için `appsettings.json` (marka + TCP/COM bağlantısı)
   - [ ] Frontend Ayarlar > ÖKC sayfasından yönetilebilsin

10. **Windows Service olarak kurulum** ⬜
    - [ ] `sc create OkcAgent` ile servis olarak kur
    - [ ] Otomatik başlatma, hata kurtarma
    - [ ] electron-builder ile birlikte paketleme (installer'da agent da kurulsun)

### Bridge: TS adapter → .NET agent

Gerçek cihaz gelince TS tarafında ufak bir HTTP adapter eklenecek:

```ts
// apps/backend/src/okc/http.adapter.ts (ileride eklenecek)
@Injectable()
export class HttpOkcAdapter implements IOkcAdapter {
  private readonly agentUrl: string;
  constructor(config: ConfigService) {
    this.agentUrl = config.get('OKC_AGENT_URL', 'http://localhost:7600');
  }
  marka() { return process.env.OKC_MARKA || 'BEKO'; }
  async satisKaydet(istek: OkcFisIstegi): Promise<OkcFisYaniti> {
    const r = await fetch(`${this.agentUrl}/satis`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(istek),
    });
    return r.json();
  }
  async durum() { /* GET /durum */ }
}
```

Sonra `okc.module.ts` switch case'e ekle, env değiştir, test et.

---

## 🟠 Sonraki Fazlar (sırayla)

### Faz 10 — Termal Yazıcı (ESC/POS)
- `node-thermal-printer` ile fiş çıktısı (mutfak siparişi + kasa fişi)
- ÖKC fişiyle ayrı: yasal fiş = ÖKC, mutfak fişi = termal
- Yazıcı eşleme: hangi kategori hangi yazıcıya gider (içecekler → bar, yemekler → mutfak)

### Faz 11 — Mobil (Capacitor)
- Aynı Nuxt build'ini iOS + Android paketle
- Garson tableti senaryosu (sipariş alma, masa yönetimi)
- Offline-first: bağlantı koparsa sipariş kuyruğa girer, geri gelince senkron

### Faz 12 — E-Fatura / E-Arşiv
- GİB e-fatura entegratörü (Foriba, Logo gibi)
- Müşteri vergi no'sundan otomatik fatura
- ÖKC fişiyle birleşik akış

### Faz 13 — Reçete Sistemi
- 1 ürün = N hammadde (1 Türk Kahvesi = 8g kahve + 50ml su + 5g şeker)
- Satışta hammadde otomatik düşer (mevcut stok düşümü genişletilir)
- Maliyet/kar marjı raporu

### Faz 14 — Yemeksepeti / Trendyol / Getir Entegrasyonu
- Marketplace siparişleri otomatik adisyona düşsün
- KDS'de "YEMEKSEPETI" rozetli kart
- Marketplace'a status push (alındı → hazırlanıyor → yola çıktı)

### Faz 15 — Sadakat / Promosyon Motoru
- Müşteri puan kazanma
- Kampanya kuralları (2 alana 1 bedava, KDV %0 günleri, vs.)

### Faz 16 — Üretim Dağıtımı
- VPS (Hetzner 45€/yıl) veya Vercel + Railway
- PostgreSQL'e geçiş (Neon)
- electron-builder ile yıllık otomatik güncelleme
- Müşteri ekleme akışı (yeni kurulum scripti)

---

## 📦 Şu An Çalışan Sistem

### Geliştirme komutları
```bash
cd C:\xampp\htdocs\rebirth-pos

# Backend + Frontend
npm run dev

# + Electron desktop
npm run dev:tum

# Sadece desktop (frontend hazır olunca)
npm run dev:desktop

# Üretim için Windows .exe
npm run build:desktop:win
```

### Endpoint'ler
- Backend: http://localhost:3001/api
- Frontend: http://localhost:3000
- WebSocket: aynı backend portunda
- Demo kullanıcı: `admin@rebirth.com` / `admin123`

### Veritabanı
- Dev: `apps/backend/prisma/dev.db` (SQLite)
- Prisma Studio: `npm --workspace apps/backend run prisma:studio`

### Kritik dosyalar
- Şema: `apps/backend/prisma/schema.prisma` (17 tablo: + `Denetim`, multi-tenant)
- Ana stil: `apps/frontend/assets/css/main.css` + `tailwind.config.ts`
- Auth: `apps/backend/src/auth/`, `apps/frontend/stores/auth.ts`
- Audit: `apps/backend/src/denetim/`
- ÖKC: `apps/backend/src/okc/` (types, mock adapter, service, controller)
- Electron: `apps/desktop/main.js` + `preload.js` + `yazici.js`

### Yeni env değişkenleri
- `OKC_MARKA` (opsiyonel, default `MOCK`) — adapter seçimi
- `OKC_AGENT_URL` (gerçek SDK gelince) — .NET agent URL'i

---

## 📝 Karar Notları

| Karar | Tarih | Neden |
|---|---|---|
| Multi-tenant: tek DB + `subeId` | 2026-05-12 | DB-per-tenant ölçek/şema migration sorunu yaratır |
| Backend: NestJS (Slim 4 yerine) | 2026-05-12 | Auth/ORM/WebSocket/Queue out-of-the-box |
| Frontend: Nuxt 3 / Vue (React değil) | 2026-05-12 | Template syntax daha okunur, Capacitor uyumlu |
| Dev DB: SQLite | 2026-05-13 | Sıfır kurulum, prod'da Neon Postgres'e geçer |
| Enum yerine string (SQLite uyumu) | 2026-05-13 | `src/common/enums.ts`'de sabit liste, Postgres geçişinde enum'a dönüşür |
| Desktop: Electron (Tauri değil) | 2026-05-13 | Rust + MSVC kurulumu engelliyor; Electron Node ile çıkıyor |
| Ödeme tipleri 4'e indirildi | 2026-05-13 | Banka Kartı, Havale, Diğer kaldırıldı |
| Ödeme: tam ekran komponent | 2026-05-13 | Modal sıkıştırıyordu, ferah POS-tarzı UI |
| Tasarım: siyah/altın/beyaz | 2026-05-13 | Premium, sade — Menulux layout'unu refine ettik |
| ÖKC: ayrı .NET aracı servisi | 2026-05-13 | SDK'lar .NET, izolasyon, çoklu terminal desteği |
| ÖKC: TS mock adapter + IOkcAdapter sözleşmesi | 2026-05-13 | Gerçek SDK gelene kadar UI ve backend uçtan uca test edilebilir; agent eklenince swap kolay |
| Refresh token: SHA-256 hash + JWT imza + jti | 2026-05-13 | DB sızıntısında plaintext yok; aynı saniyede iki refresh aynı token üretmesin diye `jti` |
| Helmet sadece /api path-bound | 2026-05-13 | Socket.IO `/socket.io/*` engine.io endpoint'lerini bozmasın |
| @nestjs/websockets + platform-socket.io root'a hoistlandı | 2026-05-13 | Workspace local'de kalınca gateway scan'i tetiklenmiyor (404). Root install zorunlu — `package.json`'a manuel ekledik |
| KDV: iskontoyu kalemlere oransal dağıt | 2026-05-13 | İskonto sonrası KDV doğru hesaplansın diye; GİB beyanına doğru gitsin |
| Çoklu KDV: `Adisyon.kdvDokumu` JSON | 2026-05-13 | ÖKC fişinde KDV1/KDV2/KDV3 bandları için, sipariş güncellemelerinde otomatik yenilenir |
| Audit log: ana işlemle aynı transaction | 2026-05-13 | İşlem rollback olursa kayıt da geri alınır; "yarı durum" yok |
| Idempotency key: per-adisyon unique | 2026-05-13 | Çift tıklamada ödeme/fiş ikilemesin; ÖKC'de GİB'e çift satış gitmesin |
| Rol guard'lar: KASIYER POS-only | 2026-05-13 | Mali/yapısal değişiklik yöneticiye; ürün fiyatı, iade, rapor erişimi sınırlı |

---

## 🚨 Bilinen Sorunlar / Borçlar

- ⚠️ **Reçete sistemi yok** — şu an sipariş alınca sadece ürünün kendi stoku düşer. Hammadde takibi için Faz 13 gerekli.
- ⚠️ **Backup stratejisi belirsiz** — SQLite dosyası elle kopyalanmalı; üretimde Neon otomatik
- ⚠️ **Otomatik test yok** — runtime entegrasyon testleri ad-hoc bash script'leri ile yapıldı (toplam 100+ assertion). Jest/Playwright kurulumu Faz 9 SDK temininden sonra düşünülecek.
- ⚠️ **Hızlı satış 3 endpoint** — `apps/frontend/pages/hizli.vue` adisyon+sipariş+ödeme'yi ayrı endpoint'lere çağırıyor; yarım kalma riski var. Ödeme idempotent ama adisyon/sipariş değil. Tek transactional endpoint açılabilir.
- ⚠️ **Bahşiş hesaplaması** — `Odeme.bahsis` mevcut ama UI'da ayrı bir alan/akış yok; AppOdemeEkrani'nde "tip ekle" var ama bahşiş için ÖKC fişine yansımıyor (bahşiş genelde fişin dışı sayılır).
- ⚠️ **Capacitor/Tauri seçimi netleşmedi** — şu an Electron, mobil için Capacitor planlanıyor
- ⚠️ **Icon dosyaları yok** — `apps/desktop/assets/icon.ico/icns/png` eklenmeli (build uyarı verir)
- ⚠️ **electron-store v8** kullanıldı (v10 ESM-only, CommonJS ile uyumsuz)
- ⚠️ **WebSocket paket hoisting** — `@nestjs/websockets` ve `@nestjs/platform-socket.io` ROOT `node_modules`'ta olmalı, sadece workspace'te ise gateway scan'i çalışmıyor (404). Yeni dev kurulumlarında dikkat: `npm install @nestjs/websockets @nestjs/platform-socket.io` repo kökünden çalıştırılmalı.

---

## 🔑 Yeni Oturum İçin Hızlı Başlangıç

Yeni Claude oturumunda şunu söyle:
> "DURUM.md'yi oku, son durumu öğren. Tasarım birleştirmeye devam ediyoruz — 14 sayfayı siyah/altın temaya geçirelim."

veya gerçek SDK temin edildiyse:
> "DURUM.md'yi oku. ÖKC için Beko SDK temin edildi, `.NET 8 agent` ve `HttpOkcAdapter` adımına geçelim."

veya farklı bir yere atlamak istersen:
> "DURUM.md'yi oku. Sıradaki Faz X'i (örn. termal yazıcı) yapmak istiyorum."

Claude bu dosyayı okuyup mevcut yapıyı, kararları ve hedefi hızlıca anlayacaktır.
