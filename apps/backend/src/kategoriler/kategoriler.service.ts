import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KategoriCreateDto, KategoriUpdateDto } from './dto/kategori.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

@Injectable()
export class KategorilerService {
  constructor(private prisma: PrismaService, private denetim: DenetimService) {}

  async liste(user: CurrentUserData, subeId?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    return this.prisma.kategori.findMany({
      where,
      orderBy: [{ subeId: 'asc' }, { sira: 'asc' }, { ad: 'asc' }],
      include: { _count: { select: { urunler: true } } },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const kat = await this.prisma.kategori.findUnique({ where: { id } });
    if (!kat) throw new NotFoundException('Kategori bulunamadı');
    subeYetkiKontrolu(user, kat.subeId);
    return kat;
  }

  async olustur(dto: KategoriCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    return this.prisma.$transaction(async (tx) => {
      const k = await tx.kategori.create({ data: dto });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.KATEGORI_OLUSTUR,
        entityTipi: 'Kategori',
        entityId: k.id,
        subeId: k.subeId,
        ozet: `Kategori oluştur: ${k.ad}`,
        sonraki: { ad: k.ad, sira: k.sira, renk: k.renk, ikon: k.ikon },
      });
      return k;
    });
  }

  async guncelle(id: string, dto: KategoriUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    return this.prisma.$transaction(async (tx) => {
      const k = await tx.kategori.update({ where: { id }, data: dto });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.KATEGORI_GUNCELLE,
        entityTipi: 'Kategori',
        entityId: id,
        subeId: k.subeId,
        ozet: `Kategori güncelle: ${k.ad}`,
        onceki: { ad: mevcut.ad, sira: mevcut.sira, renk: mevcut.renk, aktif: mevcut.aktif },
        sonraki: { ad: k.ad, sira: k.sira, renk: k.renk, aktif: k.aktif },
      });
      return k;
    });
  }

  async sil(id: string, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    return this.prisma.$transaction(async (tx) => {
      await tx.kategori.delete({ where: { id } });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.KATEGORI_SIL,
        entityTipi: 'Kategori',
        entityId: id,
        subeId: mevcut.subeId,
        ozet: `Kategori sil: ${mevcut.ad}`,
        onceki: { ad: mevcut.ad, renk: mevcut.renk, sira: mevcut.sira },
      });
      return { silindi: true };
    });
  }
}
