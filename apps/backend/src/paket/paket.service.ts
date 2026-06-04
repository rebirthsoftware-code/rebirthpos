import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaketOlusturDto } from './dto/paket.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum, Rol, SiparisDurum } from '../common/enums';
import { adisyonNumarasiUret, hesaplaAdisyonTutar } from '../adisyonlar/adisyon-hesap';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class PaketService {
  constructor(private prisma: PrismaService, private realtime: RealtimeGateway) {}

  async liste(user: CurrentUserData, subeId?: string, durum?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = { tip: { in: ['PAKET', 'GEL_AL'] } };
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    if (durum) where.paketDurum = durum;
    else where.durum = { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] };

    // Kurye'ler sadece kendine atanmış paketleri görür
    if (user.rol === Rol.KURYE) {
      where.kuryeId = user.kullaniciId;
    }

    return this.prisma.adisyon.findMany({
      where,
      include: {
        musteri: { select: { id: true, adSoyad: true, telefon: true } },
        kurye: { select: { id: true, adSoyad: true, telefon: true } },
        siparisler: { include: { kalemler: { include: { urun: { select: { ad: true } } } } } },
      },
      orderBy: { acilis: 'desc' },
    });
  }

  async olustur(dto: PaketOlusturDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    if (!dto.kalemler?.length) throw new BadRequestException('En az bir ürün gerekli');

    // Müşteriyi upsert et
    const musteri = await this.prisma.musteri.upsert({
      where: { subeId_telefon: { subeId: dto.subeId, telefon: dto.musteriTelefon } },
      update: {
        adSoyad: dto.musteriAdSoyad,
        adres: dto.adres,
      },
      create: {
        subeId: dto.subeId,
        adSoyad: dto.musteriAdSoyad,
        telefon: dto.musteriTelefon,
        adres: dto.adres,
      },
    });

    // Ürünleri doğrula
    const urunIds = dto.kalemler.map((k) => k.urunId);
    const urunler = await this.prisma.urun.findMany({ where: { id: { in: urunIds } } });
    const urunMap = new Map(urunler.map((u) => [u.id, u]));
    for (const k of dto.kalemler) {
      const u = urunMap.get(k.urunId);
      if (!u || u.subeId !== dto.subeId || !u.aktif) {
        throw new BadRequestException('Geçersiz ürün');
      }
    }

    // Adisyon numara
    const bugunBaslangic = new Date();
    bugunBaslangic.setHours(0, 0, 0, 0);
    const bugunkuSayi = await this.prisma.adisyon.count({
      where: { subeId: dto.subeId, acilis: { gte: bugunBaslangic } },
    });

    const tip = dto.tip || 'PAKET';

    const adisyon = await this.prisma.adisyon.create({
      data: {
        subeId: dto.subeId,
        acanKullaniciId: user.kullaniciId,
        musteriId: musteri.id,
        numara: adisyonNumarasiUret(bugunkuSayi),
        tip,
        durum: AdisyonDurum.ACIK,
        paketAdres: dto.adres,
        paketDurum: 'BEKLIYOR',
        not: dto.not,
        siparisler: {
          create: {
            subeId: dto.subeId,
            kullaniciId: user.kullaniciId,
            durum: SiparisDurum.ALINDI,
            kaynak: 'PANEL',
            kalemler: {
              create: dto.kalemler.map((k) => {
                const u = urunMap.get(k.urunId)!;
                const birim = new Prisma.Decimal(u.fiyat);
                return {
                  urunId: k.urunId,
                  adet: k.adet,
                  birimFiyat: birim,
                  toplam: birim.mul(k.adet),
                  not: k.not,
                };
              }),
            },
          },
        },
      },
      include: {
        musteri: true,
        siparisler: { include: { kalemler: { include: { urun: true } } } },
      },
    });

    // Toplam hesabı
    const kalemler = adisyon.siparisler.flatMap((s) =>
      s.kalemler.map((k) => ({ adet: k.adet, birimFiyat: k.birimFiyat, urunKdvOrani: k.urun.kdvOrani })),
    );
    const t = hesaplaAdisyonTutar(kalemler, 0);
    const guncel = await this.prisma.adisyon.update({
      where: { id: adisyon.id },
      data: {
        araToplam: t.araToplam,
        kdvTutar: t.kdvTutar,
        toplamTutar: t.toplamTutar,
        kdvDokumu: JSON.stringify(t.kdvDokumu),
      },
      include: { musteri: true, kurye: true },
    });

    this.realtime.yeniSiparis(dto.subeId, {
      siparisId: adisyon.siparisler[0]?.id,
      adisyonId: adisyon.id,
      kaynak: 'PAKET',
      tip,
    });

    return guncel;
  }

  async kuryeAta(adisyonId: string, kuryeId: string, user: CurrentUserData) {
    const ad = await this.prisma.adisyon.findUnique({ where: { id: adisyonId } });
    if (!ad) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, ad.subeId);

    const kurye = await this.prisma.kullanici.findUnique({
      where: { id: kuryeId },
      include: { subeler: true },
    });
    if (!kurye || kurye.rol !== Rol.KURYE) throw new BadRequestException('Geçersiz kurye');
    if (!kurye.subeler.some((s) => s.subeId === ad.subeId)) {
      throw new BadRequestException('Kurye bu şubeye atanmamış');
    }

    const guncel = await this.prisma.adisyon.update({
      where: { id: adisyonId },
      data: { kuryeId, paketDurum: 'YOLDA' },
      include: { musteri: true, kurye: true },
    });

    this.realtime.adisyonGuncellendi(ad.subeId, {
      adisyonId,
      kuryeId,
      paketDurum: 'YOLDA',
    });
    return guncel;
  }

  async paketDurumGuncelle(adisyonId: string, paketDurum: string, user: CurrentUserData) {
    const ad = await this.prisma.adisyon.findUnique({ where: { id: adisyonId } });
    if (!ad) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, ad.subeId);

    // Kurye sadece kendi paketinin durumunu değiştirebilir
    if (user.rol === Rol.KURYE && ad.kuryeId !== user.kullaniciId) {
      throw new ForbiddenException();
    }

    const guncel = await this.prisma.adisyon.update({
      where: { id: adisyonId },
      data: { paketDurum },
      include: { musteri: true, kurye: true },
    });
    this.realtime.adisyonGuncellendi(ad.subeId, { adisyonId, paketDurum });
    return guncel;
  }
}
