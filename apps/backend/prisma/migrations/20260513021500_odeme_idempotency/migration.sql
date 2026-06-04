-- AlterTable: idempotencyKey kolonu eklenir (mevcut satırlar NULL alır)
ALTER TABLE "odemeler" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex: (adisyonId, idempotencyKey) unique — SQLite'ta NULL'lar unique kontrolünden muaftır
CREATE UNIQUE INDEX "odemeler_adisyonId_idempotencyKey_key" ON "odemeler"("adisyonId", "idempotencyKey");
