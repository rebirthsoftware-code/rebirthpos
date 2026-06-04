-- CreateTable
CREATE TABLE "firmalar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ad" TEXT NOT NULL,
    "vergiNo" TEXT,
    "vergiDairesi" TEXT,
    "logoUrl" TEXT,
    "paraBirimi" TEXT NOT NULL DEFAULT 'TRY',
    "kdvOrani" DECIMAL NOT NULL DEFAULT 10.00,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "subeler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmaId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "email" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL,
    CONSTRAINT "subeler_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "firmalar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kullanicilar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eposta" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "rol" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" DATETIME,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sube_kullanicilar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kullaniciId" TEXT NOT NULL,
    "subeId" TEXT NOT NULL,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sube_kullanicilar_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sube_kullanicilar_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kullaniciId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "katlar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "katlar_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "masalar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "katId" TEXT,
    "ad" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL DEFAULT 4,
    "durum" TEXT NOT NULL DEFAULT 'BOS',
    "pozisyonX" REAL,
    "pozisyonY" REAL,
    "qrKod" TEXT,
    CONSTRAINT "masalar_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "masalar_katId_fkey" FOREIGN KEY ("katId") REFERENCES "katlar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kategoriler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "renk" TEXT,
    "ikon" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "kategoriler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "urunler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "kategoriId" TEXT,
    "ad" TEXT NOT NULL,
    "aciklama" TEXT,
    "fiyat" DECIMAL NOT NULL,
    "kdvOrani" DECIMAL NOT NULL DEFAULT 10.00,
    "resimUrl" TEXT,
    "barkod" TEXT,
    "stokTakibi" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "qrMenudeGoster" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL,
    CONSTRAINT "urunler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "urunler_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "kategoriler" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "adisyonlar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "masaId" TEXT,
    "acanKullaniciId" TEXT NOT NULL,
    "numara" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'ACIK',
    "araToplam" DECIMAL NOT NULL DEFAULT 0,
    "iskontoTutar" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL NOT NULL DEFAULT 0,
    "toplamTutar" DECIMAL NOT NULL DEFAULT 0,
    "not" TEXT,
    "acilis" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kapanis" DATETIME,
    CONSTRAINT "adisyonlar_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_masaId_fkey" FOREIGN KEY ("masaId") REFERENCES "masalar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_acanKullaniciId_fkey" FOREIGN KEY ("acanKullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "siparisler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "adisyonId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'ALINDI',
    "kaynak" TEXT NOT NULL DEFAULT 'PANEL',
    "not" TEXT,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL,
    CONSTRAINT "siparisler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "siparisler_adisyonId_fkey" FOREIGN KEY ("adisyonId") REFERENCES "adisyonlar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "siparisler_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "siparis_kalemleri" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siparisId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL NOT NULL,
    "toplam" DECIMAL NOT NULL,
    "not" TEXT,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "siparis_kalemleri_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "siparis_kalemleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "odemeler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "adisyonId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "tutar" DECIMAL NOT NULL,
    "bahsis" DECIMAL NOT NULL DEFAULT 0,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "okcFisNo" TEXT,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "odemeler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "odemeler_adisyonId_fkey" FOREIGN KEY ("adisyonId") REFERENCES "adisyonlar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "odemeler_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "musteriler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT,
    "adres" TEXT,
    "notlar" TEXT,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL,
    CONSTRAINT "musteriler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "subeler_firmaId_idx" ON "subeler"("firmaId");

-- CreateIndex
CREATE UNIQUE INDEX "kullanicilar_eposta_key" ON "kullanicilar"("eposta");

-- CreateIndex
CREATE UNIQUE INDEX "sube_kullanicilar_kullaniciId_subeId_key" ON "sube_kullanicilar"("kullaniciId", "subeId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_kullaniciId_idx" ON "refresh_tokens"("kullaniciId");

-- CreateIndex
CREATE INDEX "katlar_subeId_idx" ON "katlar"("subeId");

-- CreateIndex
CREATE UNIQUE INDEX "masalar_qrKod_key" ON "masalar"("qrKod");

-- CreateIndex
CREATE INDEX "masalar_subeId_idx" ON "masalar"("subeId");

-- CreateIndex
CREATE INDEX "masalar_katId_idx" ON "masalar"("katId");

-- CreateIndex
CREATE INDEX "kategoriler_subeId_idx" ON "kategoriler"("subeId");

-- CreateIndex
CREATE INDEX "urunler_subeId_idx" ON "urunler"("subeId");

-- CreateIndex
CREATE INDEX "urunler_kategoriId_idx" ON "urunler"("kategoriId");

-- CreateIndex
CREATE INDEX "adisyonlar_subeId_durum_idx" ON "adisyonlar"("subeId", "durum");

-- CreateIndex
CREATE INDEX "adisyonlar_masaId_idx" ON "adisyonlar"("masaId");

-- CreateIndex
CREATE INDEX "siparisler_subeId_durum_idx" ON "siparisler"("subeId", "durum");

-- CreateIndex
CREATE INDEX "siparisler_adisyonId_idx" ON "siparisler"("adisyonId");

-- CreateIndex
CREATE INDEX "siparis_kalemleri_siparisId_idx" ON "siparis_kalemleri"("siparisId");

-- CreateIndex
CREATE INDEX "odemeler_subeId_olusturuldu_idx" ON "odemeler"("subeId", "olusturuldu");

-- CreateIndex
CREATE INDEX "odemeler_adisyonId_idx" ON "odemeler"("adisyonId");

-- CreateIndex
CREATE INDEX "musteriler_subeId_idx" ON "musteriler"("subeId");

-- CreateIndex
CREATE UNIQUE INDEX "musteriler_subeId_telefon_key" ON "musteriler"("subeId", "telefon");
