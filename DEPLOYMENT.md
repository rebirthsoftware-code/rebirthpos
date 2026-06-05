# Rebirth POS — Üretim Deploy Rehberi (her şey Vercel + Neon)

Bu sistem artık `endam` gibi **tamamen Vercel'de** çalışır.

```
  ┌─────────────────────────┐      HTTPS /api/*      ┌──────────────────────────┐
  │  Vercel — Frontend       │ ─────────────────────► │  Vercel — Backend          │
  │  Nuxt 3 (repo kökü)      │      REST (polling)    │  NestJS serverless function │
  │                          │ ◄───────────────────── │  (Root Directory: apps/backend) │
  └─────────────────────────┘                         └────────────┬─────────────┘
                                                                    │ Prisma + Neon adapter
                                                                    │ HTTP (fetch / 443)
                                                                    ▼
                                                       ┌──────────────────────────┐
                                                       │     Neon PostgreSQL        │
                                                       └──────────────────────────┘
```

**Önemli mimari kararlar:**
- **Canlı güncelleme yok → polling var.** WebSocket (Socket.IO) kaldırıldı. Frontend
  her ~5 sn'de ilgili veriyi yeniden çeker (mutfak ekranı, masalar, adisyon, dashboard…).
  Böylece backend kalıcı sunucu istemez; Vercel serverless'ta çalışır. Aralık:
  `apps/frontend/composables/useSocket.ts` → `POLL_MS`.
- **Prisma → Neon HTTP.** `@prisma/adapter-neon` + `neonConfig.poolQueryViaFetch` ile
  veritabanına 443 (fetch) üzerinden bağlanılır. Serverless'ta query-engine binary ve
  TCP connection-pooling derdi olmaz; 5432 kapalı ortamlarda bile çalışır.

Kurulum = **iki Vercel projesi** (ikisi de aynı repoyu import eder): frontend (repo kökü)
ve backend (Root Directory `apps/backend`).

---

## 1) Neon PostgreSQL

Bu repoda şema + demo veri Neon'a zaten uygulandı (tablolar hazır). Yeni DB kuruyorsan:
- https://neon.tech → proje aç → **Connection string**'i kopyala.
- Adapter HTTP üzerinden çalıştığı için **pooled** (host'ta `-pooler` olan) string'i kullan.

## 2) Backend → Vercel (2. proje)

1. Vercel → **Add New → Project** → aynı repoyu **tekrar** import et.
2. **Root Directory: `apps/backend`** seç.
   (Vercel `apps/backend/vercel.json`'ı okur: build = `prisma generate && nest build`,
   fonksiyon = `api/index.js`, tüm istekler `/api`'ye yönlenir.)
3. **Environment Variables:**
   ```
   DATABASE_URL        = <Neon pooled connection string>
   JWT_SECRET          = <rastgele uzun değer>
   JWT_REFRESH_SECRET  = <başka rastgele uzun değer>
   CORS_ORIGIN         = <frontend Vercel URL'i, örn https://rebirthpos.vercel.app>
   OKC_MARKA           = MOCK
   ```
   JWT üret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. **Deploy.** Backend URL'ini al (örn `https://rebirthpos-api.vercel.app`).
   Test: `https://<backend>/api/health` → `{"status":"ok"}`.

## 3) Frontend → Vercel (mevcut proje)

1. Frontend projesi → **Settings → Environment Variables:**
   ```
   NUXT_PUBLIC_API_BASE = https://<backend>/api
   ```
2. **Deployments → Redeploy.**

## 4) Giriş

Siteye gir → `/login` → **admin@rebirth.com / admin123** (Süper Admin).

---

## Notlar & bakım

- **Polling aralığı:** `apps/frontend/composables/useSocket.ts` → `POLL_MS` (varsayılan 5000 ms).
- **CORS:** Backend `CORS_ORIGIN` = frontend Vercel URL'i (sonunda `/` olmadan). Birden
  çok alan adı virgülle ayrılır.
- **DB şeması değişirse:** Prisma `db push` TCP (5432) ister. 443-only ortamda şu işe yarar:
  `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
  → çıkan SQL'i Neon SQL editöründe çalıştır. TCP erişimin varsa:
  `npm --workspace apps/backend run db:push`.
- **Güvenlik:** Neon şifresini bir yere yapıştırdıysan panelden resetle ve env'leri güncelle.
- **Render/Railway artık gerekmiyor.** Daha önce blueprint/servis bağladıysan silebilirsin.
