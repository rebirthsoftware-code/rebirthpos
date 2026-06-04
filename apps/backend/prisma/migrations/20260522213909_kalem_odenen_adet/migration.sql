-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_siparis_kalemleri" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siparisId" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "birimFiyat" DECIMAL NOT NULL,
    "toplam" DECIMAL NOT NULL,
    "not" TEXT,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "odenenAdet" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "siparis_kalemleri_siparisId_fkey" FOREIGN KEY ("siparisId") REFERENCES "siparisler" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "siparis_kalemleri_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "urunler" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_siparis_kalemleri" ("adet", "birimFiyat", "id", "iptal", "not", "siparisId", "toplam", "urunId") SELECT "adet", "birimFiyat", "id", "iptal", "not", "siparisId", "toplam", "urunId" FROM "siparis_kalemleri";
DROP TABLE "siparis_kalemleri";
ALTER TABLE "new_siparis_kalemleri" RENAME TO "siparis_kalemleri";
CREATE INDEX "siparis_kalemleri_siparisId_idx" ON "siparis_kalemleri"("siparisId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
