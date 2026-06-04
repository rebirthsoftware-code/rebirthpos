import { Prisma } from '@prisma/client';

/**
 * Adisyonun toplam tutarını sipariş kalemlerinden hesaplar.
 * Türkiye uygulaması: ürün fiyatı KDV dahil → KDV içeriden çıkarılır.
 *
 * İskonto: kalemlere KDV-dahil tutara oransal dağıtılır, sonra her kalemin
 * KDV'si iskonto sonrası tutar üzerinden hesaplanır. Aksi halde GİB'e bildirilen
 * KDV iskontosuz tutara karşılık gelir → fişle adisyon arasında uyuşmazlık.
 *
 * kdvDokumu: KDV oranı bazında matrah/KDV ayrımı. ÖKC fişinde KDV1/KDV2/KDV3
 * bandları için gerekli.
 */
export interface KdvSatiri {
  oran: number;
  matrah: Prisma.Decimal;
  kdv: Prisma.Decimal;
}

export interface AdisyonTutarSonuc {
  araToplam: Prisma.Decimal;
  kdvTutar: Prisma.Decimal;
  toplamTutar: Prisma.Decimal;
  kdvDokumu: KdvSatiri[];
}

export function hesaplaAdisyonTutar(
  kalemler: Array<{
    adet: number;
    birimFiyat: Prisma.Decimal | number;
    urunKdvOrani: Prisma.Decimal | number;
  }>,
  iskontoTutar: Prisma.Decimal | number = 0,
): AdisyonTutarSonuc {
  let araToplamNum = 0;
  for (const k of kalemler) {
    araToplamNum += Number(k.birimFiyat) * k.adet;
  }

  // İskonto araToplamı aşamaz (negatif tutara izin verilmez)
  const iskontoNum = Math.min(Math.max(0, Number(iskontoTutar)), araToplamNum);
  const iskontoOrani = araToplamNum > 0 ? iskontoNum / araToplamNum : 0;
  const toplam = araToplamNum - iskontoNum;

  const oranBazli = new Map<number, { matrah: number; kdv: number }>();
  let kdvNum = 0;
  for (const k of kalemler) {
    const birim = Number(k.birimFiyat);
    const oran = Number(k.urunKdvOrani);
    const kalemKdvDahil = birim * k.adet * (1 - iskontoOrani);
    const kalemKdv = kalemKdvDahil * (oran / (100 + oran));
    const kalemMatrah = kalemKdvDahil - kalemKdv;
    kdvNum += kalemKdv;
    const mevcut = oranBazli.get(oran) || { matrah: 0, kdv: 0 };
    mevcut.matrah += kalemMatrah;
    mevcut.kdv += kalemKdv;
    oranBazli.set(oran, mevcut);
  }

  const kdvDokumu = Array.from(oranBazli.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([oran, v]) => ({
      oran,
      matrah: new Prisma.Decimal(v.matrah.toFixed(2)),
      kdv: new Prisma.Decimal(v.kdv.toFixed(2)),
    }));

  return {
    araToplam: new Prisma.Decimal(araToplamNum.toFixed(2)),
    kdvTutar: new Prisma.Decimal(kdvNum.toFixed(2)),
    toplamTutar: new Prisma.Decimal(toplam.toFixed(2)),
    kdvDokumu,
  };
}

export function adisyonNumarasiUret(adisyonSayisi: number): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const sira = String(adisyonSayisi + 1).padStart(4, '0');
  return `A-${yyyy}${mm}${dd}-${sira}`;
}
