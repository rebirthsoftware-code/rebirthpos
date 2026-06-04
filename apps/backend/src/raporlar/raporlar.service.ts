import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum } from '../common/enums';

@Injectable()
export class RaporlarService {
  constructor(private prisma: PrismaService) {}

  private subeFilter(user: CurrentUserData, subeId?: string) {
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      return { subeId };
    }
    const erisim = erisilebilirSubeler(user);
    return erisim.hepsi ? {} : { subeId: { in: erisim.ids } };
  }

  /**
   * Gün sonu özet raporu — kapalı adisyonlar üzerinden.
   */
  async gunSonu(user: CurrentUserData, subeId: string | undefined, tarih?: string) {
    const filter = this.subeFilter(user, subeId);
    const baslangic = tarih ? new Date(tarih) : new Date();
    baslangic.setHours(0, 0, 0, 0);
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + 1);

    const adisyonlar = await this.prisma.adisyon.findMany({
      where: {
        ...filter,
        durum: AdisyonDurum.KAPALI,
        kapanis: { gte: baslangic, lt: bitis },
      },
      include: {
        odemeler: true,
        siparisler: {
          include: { kalemler: { include: { urun: { select: { id: true, ad: true, kategoriId: true } } } } },
        },
      },
    });

    // Toplamlar
    let toplamSatis = 0;
    let toplamIskonto = 0;
    let toplamKdv = 0;
    let toplamBahsis = 0;
    let adisyonSayisi = adisyonlar.length;
    let toplamKalem = 0;
    const odemeTipiToplam: Record<string, { tutar: number; sayi: number }> = {};
    const urunSatis: Record<string, { ad: string; adet: number; tutar: number }> = {};
    const kategoriSatis: Record<string, { adet: number; tutar: number }> = {};
    const saatBazli: Record<number, number> = {};

    for (const ad of adisyonlar) {
      toplamSatis += Number(ad.toplamTutar);
      toplamIskonto += Number(ad.iskontoTutar);
      toplamKdv += Number(ad.kdvTutar);

      const saat = new Date(ad.kapanis!).getHours();
      saatBazli[saat] = (saatBazli[saat] || 0) + Number(ad.toplamTutar);

      for (const o of ad.odemeler.filter((x) => !x.iptal)) {
        toplamBahsis += Number(o.bahsis);
        if (!odemeTipiToplam[o.tip]) odemeTipiToplam[o.tip] = { tutar: 0, sayi: 0 };
        odemeTipiToplam[o.tip].tutar += Number(o.tutar);
        odemeTipiToplam[o.tip].sayi++;
      }

      for (const s of ad.siparisler) {
        for (const k of s.kalemler.filter((x) => !x.iptal)) {
          toplamKalem += k.adet;
          if (!urunSatis[k.urunId]) urunSatis[k.urunId] = { ad: k.urun.ad, adet: 0, tutar: 0 };
          urunSatis[k.urunId].adet += k.adet;
          urunSatis[k.urunId].tutar += Number(k.toplam);
          const kid = k.urun.kategoriId || 'yok';
          if (!kategoriSatis[kid]) kategoriSatis[kid] = { adet: 0, tutar: 0 };
          kategoriSatis[kid].adet += k.adet;
          kategoriSatis[kid].tutar += Number(k.toplam);
        }
      }
    }

    // Kategori adlarını çek
    const kategoriIds = Object.keys(kategoriSatis).filter((id) => id !== 'yok');
    const kategoriler = kategoriIds.length
      ? await this.prisma.kategori.findMany({
          where: { id: { in: kategoriIds } },
          select: { id: true, ad: true },
        })
      : [];

    return {
      tarih: baslangic.toISOString().substring(0, 10),
      adisyonSayisi,
      toplamSatis,
      toplamIskonto,
      toplamKdv,
      toplamBahsis,
      toplamKalem,
      ortalamaAdisyon: adisyonSayisi ? toplamSatis / adisyonSayisi : 0,
      odemeTipleri: Object.entries(odemeTipiToplam).map(([tip, v]) => ({ tip, ...v })),
      enCokSatanlar: Object.entries(urunSatis)
        .sort((a, b) => b[1].tutar - a[1].tutar)
        .slice(0, 10)
        .map(([id, v]) => ({ urunId: id, ...v })),
      kategoriler: Object.entries(kategoriSatis).map(([id, v]) => ({
        kategoriId: id === 'yok' ? null : id,
        ad: id === 'yok' ? 'Kategorisiz' : kategoriler.find((x) => x.id === id)?.ad || '?',
        ...v,
      })),
      saatBazli: Array.from({ length: 24 }, (_, h) => ({ saat: h, tutar: saatBazli[h] || 0 })),
    };
  }

  /**
   * Aylık özet — bu ay vs geçen ay karşılaştırması, günlük seri, KDV bantları.
   * ay parametresi YYYY-MM formatında; verilmezse içinde bulunulan ay.
   */
  async aylikOzet(user: CurrentUserData, subeId: string | undefined, ay?: string) {
    const filter = this.subeFilter(user, subeId);

    function ayinIlkSon(yyyymm?: string) {
      const simdi = new Date();
      let yil = simdi.getFullYear();
      let ayNo = simdi.getMonth(); // 0-11
      if (yyyymm && /^\d{4}-\d{2}$/.test(yyyymm)) {
        const [y, m] = yyyymm.split('-').map(Number);
        yil = y;
        ayNo = m - 1;
      }
      const baslangic = new Date(yil, ayNo, 1, 0, 0, 0, 0);
      const bitis = new Date(yil, ayNo + 1, 1, 0, 0, 0, 0);
      return { baslangic, bitis, yil, ayNo };
    }

    const buAy = ayinIlkSon(ay);
    // Geçen ay
    const onAyTarih = new Date(buAy.baslangic);
    onAyTarih.setMonth(onAyTarih.getMonth() - 1);
    const onceki = ayinIlkSon(`${onAyTarih.getFullYear()}-${String(onAyTarih.getMonth() + 1).padStart(2, '0')}`);

    async function ayAggregate(prisma: any, donem: { baslangic: Date; bitis: Date }) {
      const adisyonlar = await prisma.adisyon.findMany({
        where: {
          ...filter,
          durum: AdisyonDurum.KAPALI,
          kapanis: { gte: donem.baslangic, lt: donem.bitis },
        },
        include: { odemeler: true },
      });
      let toplamSatis = 0;
      let toplamKdv = 0;
      let toplamIskonto = 0;
      let toplamBahsis = 0;
      const odemeTipiToplam: Record<string, { tutar: number; sayi: number }> = {};
      const gunluk: Record<string, number> = {};
      const kdvBantOku: Record<number, { matrah: number; kdv: number }> = {};
      for (const ad of adisyonlar) {
        toplamSatis += Number(ad.toplamTutar);
        toplamKdv += Number(ad.kdvTutar);
        toplamIskonto += Number(ad.iskontoTutar);
        const g = new Date(ad.kapanis).toISOString().slice(0, 10);
        gunluk[g] = (gunluk[g] || 0) + Number(ad.toplamTutar);
        if (ad.kdvDokumu) {
          try {
            const arr = JSON.parse(ad.kdvDokumu);
            for (const k of arr) {
              const oran = Number(k.oran);
              if (!kdvBantOku[oran]) kdvBantOku[oran] = { matrah: 0, kdv: 0 };
              kdvBantOku[oran].matrah += Number(k.matrah);
              kdvBantOku[oran].kdv += Number(k.kdv);
            }
          } catch {}
        }
        for (const o of ad.odemeler.filter((x: any) => !x.iptal)) {
          toplamBahsis += Number(o.bahsis);
          if (!odemeTipiToplam[o.tip]) odemeTipiToplam[o.tip] = { tutar: 0, sayi: 0 };
          odemeTipiToplam[o.tip].tutar += Number(o.tutar);
          odemeTipiToplam[o.tip].sayi++;
        }
      }
      return {
        adisyonSayisi: adisyonlar.length,
        toplamSatis: Number(toplamSatis.toFixed(2)),
        toplamKdv: Number(toplamKdv.toFixed(2)),
        toplamIskonto: Number(toplamIskonto.toFixed(2)),
        toplamBahsis: Number(toplamBahsis.toFixed(2)),
        ortalamaAdisyon: adisyonlar.length ? Number((toplamSatis / adisyonlar.length).toFixed(2)) : 0,
        odemeTipleri: Object.entries(odemeTipiToplam).map(([tip, v]) => ({ tip, ...v })),
        gunluk,
        kdvBantlari: Object.entries(kdvBantOku)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([oran, v]) => ({ oran: Number(oran), matrah: Number(v.matrah.toFixed(2)), kdv: Number(v.kdv.toFixed(2)) })),
      };
    }

    const [bu, gecen] = await Promise.all([
      ayAggregate(this.prisma, buAy),
      ayAggregate(this.prisma, onceki),
    ]);

    // Günlük seri (ayın tüm günleri için)
    const gunSayisi = Math.ceil((buAy.bitis.getTime() - buAy.baslangic.getTime()) / 86400000);
    const gunlukSeri: { gun: number; tarih: string; tutar: number }[] = [];
    for (let g = 0; g < gunSayisi; g++) {
      const d = new Date(buAy.baslangic);
      d.setDate(d.getDate() + g);
      const key = d.toISOString().slice(0, 10);
      gunlukSeri.push({ gun: g + 1, tarih: key, tutar: bu.gunluk[key] || 0 });
    }

    function degisim(yeni: number, eski: number) {
      if (eski === 0) return yeni === 0 ? 0 : 100;
      return Number((((yeni - eski) / eski) * 100).toFixed(1));
    }

    return {
      ay: `${buAy.yil}-${String(buAy.ayNo + 1).padStart(2, '0')}`,
      ayAdi: buAy.baslangic.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      donem: {
        baslangic: buAy.baslangic.toISOString(),
        bitis: buAy.bitis.toISOString(),
      },
      buAy: bu,
      gecenAy: gecen,
      degisim: {
        toplamSatis: degisim(bu.toplamSatis, gecen.toplamSatis),
        adisyonSayisi: degisim(bu.adisyonSayisi, gecen.adisyonSayisi),
        ortalamaAdisyon: degisim(bu.ortalamaAdisyon, gecen.ortalamaAdisyon),
      },
      gunlukSeri,
    };
  }

  async personelPerformans(user: CurrentUserData, subeId: string | undefined, tarih?: string) {
    const filter = this.subeFilter(user, subeId);
    const baslangic = tarih ? new Date(tarih) : new Date();
    baslangic.setHours(0, 0, 0, 0);
    const bitis = new Date(baslangic);
    bitis.setDate(bitis.getDate() + 1);

    const adisyonlar = await this.prisma.adisyon.findMany({
      where: {
        ...filter,
        durum: AdisyonDurum.KAPALI,
        kapanis: { gte: baslangic, lt: bitis },
      },
      include: { acanKullanici: { select: { id: true, adSoyad: true, rol: true } } },
    });

    const stats: Record<string, { adSoyad: string; rol: string; adisyon: number; ciro: number }> = {};
    for (const ad of adisyonlar) {
      const u = ad.acanKullanici;
      if (!stats[u.id]) stats[u.id] = { adSoyad: u.adSoyad, rol: u.rol, adisyon: 0, ciro: 0 };
      stats[u.id].adisyon++;
      stats[u.id].ciro += Number(ad.toplamTutar);
    }
    return Object.entries(stats).map(([id, v]) => ({ kullaniciId: id, ...v }));
  }
}
