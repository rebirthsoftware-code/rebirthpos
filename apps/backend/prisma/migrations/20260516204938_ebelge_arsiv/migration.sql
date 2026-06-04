-- AlterTable
ALTER TABLE "musteriler" ADD COLUMN "vergiDairesi" TEXT;
ALTER TABLE "musteriler" ADD COLUMN "vergiNo" TEXT;

-- CreateTable
CREATE TABLE "e_belgeler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT NOT NULL,
    "adisyonId" TEXT,
    "musteriId" TEXT,
    "kullaniciId" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'TASLAK',
    "ettn" TEXT NOT NULL,
    "belgeNo" TEXT NOT NULL,
    "marka" TEXT NOT NULL DEFAULT 'MOCK',
    "aliciAd" TEXT NOT NULL,
    "aliciVergiNo" TEXT,
    "aliciVergiDairesi" TEXT,
    "aliciAdres" TEXT,
    "aliciEposta" TEXT,
    "aliciTelefon" TEXT,
    "araToplam" DECIMAL NOT NULL,
    "iskontoTutar" DECIMAL NOT NULL DEFAULT 0,
    "kdvTutar" DECIMAL NOT NULL,
    "toplamTutar" DECIMAL NOT NULL,
    "kdvDokumu" TEXT,
    "kalemler" TEXT,
    "odemeler" TEXT,
    "not" TEXT,
    "ekMeta" TEXT,
    "pdfUrl" TEXT,
    "duzenlenmeTarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gonderilmeTarihi" DATETIME,
    "onaylanmaTarihi" DATETIME,
    "iptalTarihi" DATETIME,
    CONSTRAINT "e_belgeler_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "e_belgeler_adisyonId_fkey" FOREIGN KEY ("adisyonId") REFERENCES "adisyonlar" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "e_belgeler_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "musteriler" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "e_belgeler_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "e_belgeler_ettn_key" ON "e_belgeler"("ettn");

-- CreateIndex
CREATE UNIQUE INDEX "e_belgeler_belgeNo_key" ON "e_belgeler"("belgeNo");

-- CreateIndex
CREATE INDEX "e_belgeler_subeId_duzenlenmeTarihi_idx" ON "e_belgeler"("subeId", "duzenlenmeTarihi");

-- CreateIndex
CREATE INDEX "e_belgeler_adisyonId_idx" ON "e_belgeler"("adisyonId");

-- CreateIndex
CREATE INDEX "e_belgeler_musteriId_idx" ON "e_belgeler"("musteriId");
