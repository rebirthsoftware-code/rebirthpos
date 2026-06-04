-- Adisyon'a ÖKC fişi alanları
ALTER TABLE "adisyonlar" ADD COLUMN "okcFisNo" TEXT;
ALTER TABLE "adisyonlar" ADD COLUMN "okcFisTarihi" DATETIME;
ALTER TABLE "adisyonlar" ADD COLUMN "okcMarka" TEXT;

-- okcFisNo şube içinde unique olmalı — aynı fiş no iki kez kesilmesin
CREATE UNIQUE INDEX "adisyonlar_subeId_okcFisNo_key" ON "adisyonlar"("subeId", "okcFisNo");
