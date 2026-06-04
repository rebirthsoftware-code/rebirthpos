-- CreateTable
CREATE TABLE "denetim_kayitlari" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subeId" TEXT,
    "kullaniciId" TEXT,
    "islem" TEXT NOT NULL,
    "entityTipi" TEXT NOT NULL,
    "entityId" TEXT,
    "ozet" TEXT,
    "onceki" TEXT,
    "sonraki" TEXT,
    "ip" TEXT,
    "olusturuldu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "denetim_kayitlari_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "subeler" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "denetim_kayitlari_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanicilar" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "denetim_kayitlari_subeId_olusturuldu_idx" ON "denetim_kayitlari"("subeId", "olusturuldu");

-- CreateIndex
CREATE INDEX "denetim_kayitlari_entityTipi_entityId_idx" ON "denetim_kayitlari"("entityTipi", "entityId");

-- CreateIndex
CREATE INDEX "denetim_kayitlari_islem_olusturuldu_idx" ON "denetim_kayitlari"("islem", "olusturuldu");
