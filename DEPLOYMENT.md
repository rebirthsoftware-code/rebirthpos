# Rebirth POS — Üretim Deploy Rehberi (Vercel + Render + Neon)

Bu sistem `endamsince` gibi tek bir Next.js uygulaması **değil**; ayrı bir
**NestJS backend** (kalıcı sunucu + Socket.IO canlı bildirim) ve **Nuxt 3
frontend** içeren bir monorepo. Vercel'in serverless yapısı kalıcı WebSocket
bağlantısını desteklemediği için mimari şöyle kurulur:

```
   ┌──────────────┐      HTTPS / WSS      ┌─────────────────────┐
   │   Vercel     │ ───────────────────► │   Render (veya       │
   │  Nuxt 3 SPA  │   /api + /socket.io  │   Railway)           │
   │  (frontend)  │ ◄─────────────────── │   NestJS backend     │
   └──────────────┘                       └──────────┬──────────┘
                                                     │ Prisma
                                                     ▼
                                          ┌─────────────────────┐
                                          │   Neon PostgreSQL    │
                                          │   (DATABASE_URL)     │
                                          └─────────────────────┘
```

Veritabanı bağlantısı `endam` ile **birebir aynı** desende: Prisma
`postgresql` provider + `DATABASE_URL`, `postinstall: prisma generate`,
build sırasında `prisma db push` + seed (bkz. `apps/backend/scripts/db-prepare.mjs`).

---

## 1) Neon PostgreSQL oluştur (ücretsiz)

1. https://neon.tech → GitHub ile giriş yap
2. **Create project** → ad: `rebirthpos`, region: `Europe (Frankfurt)`
3. **Connection string**'i kopyala (`postgresql://...@...neon.tech/...?sslmode=require`)

Bu değer backend `DATABASE_URL`'i olacak.

> **Hangi connection string?** Render'da **direct / unpooled** olanı kullan
> (Neon'un `DATABASE_URL_UNPOOLED` değeri — host'ta `-pooler` **yok**).
> Sebebi: `prisma db push` doğrudan bağlantı ister; pooled (PgBouncer)
> string ile schema işlemleri hata verir. Kalıcı sunucu az bağlantı
> tuttuğu için pooler'a da gerek yok.
> (İleride serverless'a geçersen: pooled string + `?pgbouncer=true`.)

## 2) JWT secret'larını üret

İki ayrı güçlü değer üret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Birini `JWT_SECRET`, diğerini `JWT_REFRESH_SECRET` için kullan.

## 3) Backend'i Render'a kur

### Seçenek A — Blueprint (otomatik, önerilen)

Repoda hazır `render.yaml` var.

1. https://render.com → **New** → **Blueprint**
2. Bu repoyu seç → Render `render.yaml`'ı okur
3. Açılan env değişkenlerini gir:
   - `DATABASE_URL` → Neon connection string
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` → adım 2'deki değerler
   - `CORS_ORIGIN` → **şimdilik boş/placeholder geç** (adım 5'te Vercel URL'i ile dolduracağız)
4. **Apply** → ilk deploy başlar

Build sırasında otomatik olarak:
`npm install` → `prisma generate` → `nest build` → `prisma db push` (şema Neon'a kurulur) → `seed` (demo veri).

### Seçenek B — Manuel Web Service

Blueprint kullanmak istemezsen: **New → Web Service**, repoyu bağla ve:

| Ayar | Değer |
|---|---|
| Environment | Node |
| Region | Frankfurt |
| Build Command | `npm install --include=dev && npm run build:backend && npm --workspace apps/backend run db:deploy` |
| Start Command | `npm --workspace apps/backend run start:prod` |
| Health Check Path | `/api/health` |

Env değişkenleri: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`, `CORS_ORIGIN`,
`NODE_VERSION=22`, `OKC_MARKA=MOCK`.

Deploy bitince backend URL'ini not al: `https://rebirthpos-backend.onrender.com`
→ sağlık kontrolü: `…/api/health` → `{"status":"ok",...}`

### Railway alternatifi

Railway de çalışır (aynı kalıcı sunucu + WebSocket). New Project → Deploy
from repo → Settings'te:
- **Build Command:** `npm install --include=dev && npm run build:backend && npm --workspace apps/backend run db:deploy`
- **Start Command:** `npm --workspace apps/backend run start:prod`
- Aynı env değişkenlerini gir. Railway `PORT`'u otomatik enjekte eder.

## 4) Frontend'i Vercel'e kur

1. https://vercel.com → **Add New → Project** → bu repoyu içe aktar
2. **Root Directory:** `apps/frontend` seç  ← önemli (monorepo)
3. Framework Preset: **Nuxt** (otomatik algılanır)
4. **Environment Variables:**
   - `NUXT_PUBLIC_API_BASE` = `https://rebirthpos-backend.onrender.com/api`
     (adım 3'teki backend URL'i + `/api`)
5. **Deploy**

Nuxt, Vercel ortamında Nitro `vercel` preset'ini kendiliğinden seçer; ek
ayar gerekmez. Frontend URL'ini not al: `https://rebirthpos.vercel.app`

## 5) CORS'u bağla (son adım)

Backend'in Vercel'den gelen istekleri kabul etmesi için:

1. Render → backend servisi → **Environment** →
   `CORS_ORIGIN` = `https://rebirthpos.vercel.app`
   (birden çok alan adı virgülle: `https://a.vercel.app,https://b.com`)
2. Render servisini **Manual Deploy / Restart** ile yeniden başlat

> WebSocket (Socket.IO) aynı `CORS_ORIGIN` ve aynı backend host üzerinden
> çalışır; frontend `NUXT_PUBLIC_API_BASE`'ten `/api`'yi atıp socket'e bağlanır.

## 6) Doğrulama

- `https://…onrender.com/api/health` → `{"status":"ok"}`
- Vercel sitesine gir → `/login`
- Demo giriş: **admin@rebirth.com / admin123** (Süper Admin)
- Mutfak ekranı / masalar canlı güncelleniyorsa WebSocket bağlandı demektir.

---

## Notlar & Uyarılar

- **Migration yerine `db push`:** `endam` deseni gibi şema doğrudan
  uygulanır (migration geçmişi tutulmaz). Eski SQLite migration'ları bu
  yüzden kaldırıldı. Tek doğru kaynak: `apps/backend/prisma/schema.prisma`.
- **`--accept-data-loss`:** `db-prepare.mjs` bu bayrağı kullanır. İlk
  kurulumda (boş DB) sorunsuz. **Gerçek satış verisi oluştuktan sonra**
  kolon silen şema değişikliklerinde veri kaybı olabilir — o aşamada
  `prisma migrate` akışına geçmen önerilir.
- **Render free tier:** servis 15 dk inaktiflikte uyur; ilk istek ~30 sn
  gecikir (cold start). Sürekli açık POS için ücretli plan ya da Railway.
- **Neon free tier:** otomatik scale-to-zero; ilk sorguda kısa gecikme olabilir.
- **Seed her deploy'da çalışır** ama `upsert` olduğu için mevcut veriyi bozmaz.
- **Desktop (Electron):** ayrı paketlenir; web deploy'unu etkilemez.
  `NUXT_PUBLIC_API_BASE`'i kendi backend URL'ine göre derlenir.
