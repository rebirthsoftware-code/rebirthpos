# Rebirth POS

Çok şubeli restoran yönetim sistemi. Web + Mobil + Masaüstü tek kod tabanı.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | NestJS 10 + TypeScript + Prisma 5 |
| Veritabanı | PostgreSQL (Neon — bulut, ücretsiz tier) |
| Frontend | Nuxt 3 + Vue 3 + TypeScript + Tailwind |
| State | Pinia |
| Auth | JWT (access + refresh token) |
| Mobil | Capacitor (sonraki fazda) |
| Masaüstü | Tauri 2 (sonraki fazda) |

## Proje Yapısı

```
rebirth-pos/
├── apps/
│   ├── backend/    NestJS API (port 3001)
│   └── frontend/   Nuxt 3 SPA (port 3000)
├── .env.example
└── package.json    npm workspaces kök
```

## İlk Kurulum

### 1. Bağımlılıkları yükle

```bash
cd C:\xampp\htdocs\rebirth-pos
npm install
```

(İlk çalıştırmada Nuxt + NestJS bağımlılıkları indirilir — birkaç dakika sürer.)

### 2. Neon PostgreSQL hesabı oluştur (ücretsiz)

1. https://neon.tech adresine git
2. Ücretsiz hesap aç (GitHub ile giriş olabilir)
3. "Create project" → adını **rebirth-pos** koy
4. "Connection string" değerini kopyala (postgresql:// ile başlar)

### 3. Backend .env dosyasını oluştur

`apps/backend/.env` dosyası oluştur:

```env
DATABASE_URL="postgresql://kopyaladigin-deger-buraya"
JWT_SECRET="su-an-uretecegim-uzun-rastgele-bir-deger-yaz"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="bambaska-uzun-rastgele-bir-deger"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

> JWT_SECRET ve JWT_REFRESH_SECRET için terminalde:
> `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 4. Veritabanı şemasını uygula + demo veri

```bash
cd apps/backend
npx prisma migrate dev --name init
npm run seed
```

Bu komutlar:
- Tüm tabloları Neon'da oluşturur
- Demo firma + şube + 2 kullanıcı ekler:
  - `admin@rebirth.com` / `admin123` (Süper Admin)
  - `mudur@rebirth.com` / `admin123` (Şube Müdürü)

### 5. Çalıştır

Proje kökünden:

```bash
cd C:\xampp\htdocs\rebirth-pos
npm run dev
```

- Backend: http://localhost:3001/api/health
- Frontend: http://localhost:3000

Frontend açıldığında `/login` sayfasına yönlendirir. Demo bilgileri ile giriş yap.

## Geliştirme Komutları

```bash
# Sadece backend
npm --workspace apps/backend run dev

# Sadece frontend
npm --workspace apps/frontend run dev

# Prisma Studio (DB görsel arayüz)
npm --workspace apps/backend run prisma:studio

# Yeni migration
cd apps/backend && npx prisma migrate dev --name aciklayici-isim
```

## Üretim Deploy (Vercel + Render + Neon)

Mimari: **Frontend → Vercel · Backend → Render/Railway · DB → Neon Postgres**.
NestJS backend kalıcı sunucu + Socket.IO (canlı bildirim) gerektirdiği için
Vercel serverless yerine kalıcı sunucuda; Nuxt frontend Vercel'de çalışır.

Veritabanı bağlantısı `endam` ile aynı desende: Prisma `postgresql` +
`DATABASE_URL`, `postinstall: prisma generate`, build'de `prisma db push` + seed.

Tam adım adım rehber: **[DEPLOYMENT.md](DEPLOYMENT.md)**. Kısaca:

1. [Neon](https://neon.tech)'da Postgres aç → `DATABASE_URL` al
2. Backend'i Render'a kur (`render.yaml` blueprint hazır) → env değişkenlerini gir
3. Frontend'i Vercel'e kur (Root Directory: `apps/frontend`, `NUXT_PUBLIC_API_BASE` = Render URL'i + `/api`)
4. Backend `CORS_ORIGIN`'i Vercel URL'ine ayarla → restart

## Yol Haritası

- ✅ **Faz 0** — Proje iskeleti, multi-tenant DB şeması, auth, login, dashboard
- ⏳ **Faz 1** — Şube + ürün + kategori + masa CRUD ekranları
- ⏳ **Faz 2** — Adisyon + sipariş + ödeme akışı
- ⏳ **Faz 3** — QR menü + WebSocket canlı bildirim + termal yazıcı
- ⏳ **Faz 4** — Stok + reçete + personel + raporlar
- ⏳ **Faz 5** — Mobil (Capacitor) + Masaüstü (Tauri) paketleme
- ⏳ **Faz 6** — ÖKC entegrasyonu (Beko + Ingenico) — yerel .NET agent
- ⏳ **Faz 7** — E-fatura, sadakat, kurye, üçüncü taraf entegrasyon

## Multi-tenant Mimarisi

Her tabloda `subeId` kolonu vardır. Backend middleware her sorguya otomatik filtre ekler:

- **Süper Admin** → tüm şubeleri görür
- **Firma Admin** → o firmanın tüm şubelerini görür
- **Diğer roller** → sadece atandıkları şubeleri görür

JWT payload'da `subeIds` listesi taşınır, guard'lar bu liste ile kontrol eder.
