import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MusteriCreateDto, MusteriUpdateDto } from './dto/musteri.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

@Injectable()
export class MusterilerService {
  constructor(private prisma: PrismaService, private denetim: DenetimService) {}

  async liste(user: CurrentUserData, subeId?: string, arama?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    if (arama) {
      where.OR = [
        { adSoyad: { contains: arama } },
        { telefon: { contains: arama } },
      ];
    }
    return this.prisma.musteri.findMany({
      where,
      orderBy: { guncellendi: 'desc' },
      take: 100,
    });
  }

  async telefonAra(subeId: string, telefon: string, user: CurrentUserData) {
    subeYetkiKontrolu(user, subeId);
    return this.prisma.musteri.findUnique({
      where: { subeId_telefon: { subeId, telefon } },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const m = await this.prisma.musteri.findUnique({
      where: { id },
      include: {
        adisyonlar: {
          orderBy: { acilis: 'desc' },
          take: 20,
          select: { id: true, numara: true, durum: true, toplamTutar: true, acilis: true },
        },
      },
    });
    if (!m) throw new NotFoundException('Müşteri bulunamadı');
    subeYetkiKontrolu(user, m.subeId);
    return m;
  }

  async olustur(dto: MusteriCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    // upsert — mevcut müşteri varsa güncelle. Hangi durumda olduğumuzu bilmek
    // için önce arıyoruz; sonra audit doğru olayla kaydedilir.
    const mevcut = await this.prisma.musteri.findUnique({
      where: { subeId_telefon: { subeId: dto.subeId, telefon: dto.telefon } },
    });

    return this.prisma.$transaction(async (tx) => {
      const m = await tx.musteri.upsert({
        where: { subeId_telefon: { subeId: dto.subeId, telefon: dto.telefon } },
        update: {
          adSoyad: dto.adSoyad,
          email: dto.email,
          adres: dto.adres,
          notlar: dto.notlar,
        },
        create: dto,
      });
      await this.denetim.kaydet(tx, user, {
        islem: mevcut ? DenetimOlay.MUSTERI_GUNCELLE : DenetimOlay.MUSTERI_OLUSTUR,
        entityTipi: 'Musteri',
        entityId: m.id,
        subeId: m.subeId,
        ozet: `${mevcut ? 'Güncelle' : 'Oluştur'}: ${m.adSoyad} (${m.telefon})`,
        onceki: mevcut
          ? { adSoyad: mevcut.adSoyad, adres: mevcut.adres, email: mevcut.email }
          : undefined,
        sonraki: { adSoyad: m.adSoyad, adres: m.adres, email: m.email },
      });
      return m;
    });
  }

  async guncelle(id: string, dto: MusteriUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.musteri.update({ where: { id }, data: dto });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.MUSTERI_GUNCELLE,
        entityTipi: 'Musteri',
        entityId: id,
        subeId: m.subeId,
        ozet: `Güncelle: ${m.adSoyad} (${m.telefon})`,
        onceki: { adSoyad: mevcut.adSoyad, adres: mevcut.adres, email: mevcut.email, notlar: mevcut.notlar },
        sonraki: { adSoyad: m.adSoyad, adres: m.adres, email: m.email, notlar: m.notlar },
      });
      return m;
    });
  }

  async sil(id: string, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    return this.prisma.$transaction(async (tx) => {
      await tx.musteri.delete({ where: { id } });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.MUSTERI_SIL,
        entityTipi: 'Musteri',
        entityId: id,
        subeId: mevcut.subeId,
        ozet: `Sil: ${mevcut.adSoyad} (${mevcut.telefon})`,
        onceki: {
          adSoyad: mevcut.adSoyad,
          telefon: mevcut.telefon,
          adres: mevcut.adres,
          adisyonSayisi: mevcut.adisyonlar.length,
        },
      });
      return { silindi: true };
    });
  }
}
