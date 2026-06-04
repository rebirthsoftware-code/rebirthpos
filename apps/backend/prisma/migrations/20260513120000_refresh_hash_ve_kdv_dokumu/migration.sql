-- Mevcut refresh token'lar artık hash'lenmiş kolonla uyumsuz — temizle.
-- Tüm kullanıcılar bir kere yeniden login olacak (secret rotation efekti).
DELETE FROM "refresh_tokens";

-- refresh_tokens tablosunu yeniden yarat: token -> tokenHash
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kullaniciId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "refresh_tokens";
ALTER TABLE "new_refresh_tokens" RENAME TO "refresh_tokens";

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_kullaniciId_iptal_idx" ON "refresh_tokens"("kullaniciId", "iptal");

PRAGMA foreign_keys=ON;

-- Adisyon: KDV oran bazlı döküm JSON kolonu (ÖKC fişi için)
ALTER TABLE "adisyonlar" ADD COLUMN "kdvDokumu" TEXT;
