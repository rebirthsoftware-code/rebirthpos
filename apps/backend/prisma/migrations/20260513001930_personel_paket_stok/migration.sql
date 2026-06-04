-- CreateTable
CREATE TABLE "stok_hareketleri" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "miktar" DECIMAL NOT NULL,
    "oncesi" DECIMAL NOT NULL,
    "sonrasi" DECIMAL NOT NULL,
    "aciklama" TEXT,
    "kullaniciId" TEXT,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stok_hareketleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stok_hareketleri_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_adisyonlar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "masaId" TEXT,
    "acanKullaniciId" TEXT NOT NULL,
    "musteriId" TEXT,
    "kuryeId" TEXT,
    "numara" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT 'MASA',
    "durum" TEXT NOT NULL DEFAULT 'ACIK',
    "araToplam" DECIMAL NOT NULL DEFAULT 0,
    "iskontoTutar" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL NOT NULL DEFAULT 0,
    "toplamTutar" DECIMAL NOT NULL DEFAULT 0,
    "paketAdres" TEXT,
    "paketDurum" TEXT,
    "not" TEXT,
    "acilis" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kapanis" DATETIME,
    CONSTRAINT "adisyonlar_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_masaId_fkey" FOREIGN KEY ("masaId") REFERENCES "masalar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_acanKullaniciId_fkey" FOREIGN KEY ("acanKullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_kuryeId_fkey" FOREIGN KEY ("kuryeId") REFERENCES "kullanicilar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "adisyonlar_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "musteriler" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_adisyonlar" ("acanKullaniciId", "acilis", "araToplam", "durum", "id", "iskontoTutar", "kapanis", "kdvTutar", "masaId", "not", "numara", "subeId", "toplamTutar") SELECT "acanKullaniciId", "acilis", "araToplam", "durum", "id", "iskontoTutar", "kapanis", "kdvTutar", "masaId", "not", "numara", "subeId", "toplamTutar" FROM "adisyonlar";
DROP TABLE "adisyonlar";
ALTER TABLE "new_adisyonlar" RENAME TO "adisyonlar";
CREATE INDEX "adisyonlar_subeId_durum_idx" ON "adisyonlar"("subeId", "durum");
CREATE INDEX "adisyonlar_masaId_idx" ON "adisyonlar"("masaId");
CREATE INDEX "adisyonlar_kuryeId_idx" ON "adisyonlar"("kuryeId");
CREATE INDEX "adisyonlar_musteriId_idx" ON "adisyonlar"("musteriId");
CREATE TABLE "new_urunler" (
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
    "stok" DECIMAL NOT NULL DEFAULT 0,
    "stokBirim" TEXT NOT NULL DEFAULT 'adet',
    "stokUyariEsigi" DECIMAL NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "qrMenudeGoster" BOOLEAN NOT NULL DEFAULT true,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellendi" DATETIME NOT NULL,
    CONSTRAINT "urunler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "urunler_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "kategoriler" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_urunler" ("aciklama", "ad", "aktif", "barkod", "fiyat", "guncellendi", "id", "kategoriId", "kdvOrani", "olusturuldu", "qrMenudeGoster", "resimUrl", "stokTakibi", "subeId") SELECT "aciklama", "ad", "aktif", "barkod", "fiyat", "guncellendi", "id", "kategoriId", "kdvOrani", "olusturuldu", "qrMenudeGoster", "resimUrl", "stokTakibi", "subeId" FROM "urunler";
DROP TABLE "urunler";
ALTER TABLE "new_urunler" RENAME TO "urunler";
CREATE INDEX "urunler_subeId_idx" ON "urunler"("subeId");
CREATE INDEX "urunler_kategoriId_idx" ON "urunler"("kategoriId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "stok_hareketleri_subeId_idx" ON "stok_hareketleri"("subeId");

-- CreateIndex
CREATE INDEX "stok_hareketleri_urunId_olusturuldu_idx" ON "stok_hareketleri"("urunId", "olusturuldu");
