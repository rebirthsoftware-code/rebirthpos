import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { KullaniciCreateDto, KullaniciUpdateDto } from './dto/kullanici.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { Rol } from '../common/enums';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

const HASSAS_ALANLAR = { sifreHash: false } as any;

@Injectable()
export class KullanicilarService {
  constructor(private prisma: PrismaService, private denetim: DenetimService) {}

  private maskele<T extends { sifreHash?: string }>(k: T) {
    const { sifreHash, ...rest } = k;
    return rest;
  }

  async liste(user: CurrentUserData) {
    const erisim = erisilebilirSubeler(user);
    const kullanicilar = await this.prisma.kullanici.findMany({
      where: erisim.hepsi
        ? {}
        : {
            OR: [
              // bağlı oldukları şubelerden en az birinde olan kullanıcılar
              { subeler: { some: { subeId: { in: erisim.ids } } } },
            ],
          },
      include: {
        subeler: { include: { sube: { select: { id: true, ad: true } } } },
      },
      orderBy: [{ aktif: 'desc' }, { adSoyad: 'asc' }],
    });
    return kullanicilar.map((k) => this.maskele(k));
  }

  async getir(id: string, user: CurrentUserData) {
    const k = await this.prisma.kullanici.findUnique({
      where: { id },
      include: { subeler: { include: { sube: true } } },
    });
    if (!k) throw new NotFoundException('Kullanıcı bulunamadı');
    // SUPER/FIRMA admin değilse, kendi şubelerinde olmayan kullanıcıyı göremez
    const erisim = erisilebilirSubeler(user);
    if (!erisim.hepsi) {
      const kullanicininSubeleri = k.subeler.map((s) => s.subeId);
      if (!kullanicininSubeleri.some((id) => erisim.ids.includes(id))) {
        throw new ForbiddenException('Yetkisiz erişim');
      }
    }
    return this.maskele(k);
  }

  async olustur(dto: KullaniciCreateDto, user: CurrentUserData) {
    if (user.rol !== Rol.SUPER_ADMIN && user.rol !== Rol.FIRMA_ADMIN && user.rol !== Rol.SUBE_MUDURU) {
      throw new ForbiddenException('Personel ekleme yetkiniz yok');
    }
    if (dto.rol === Rol.SUPER_ADMIN && user.rol !== Rol.SUPER_ADMIN) {
      throw new ForbiddenException('Süper admin yalnızca süper admin oluşturabilir');
    }
    const mevcut = await this.prisma.kullanici.findUnique({ where: { eposta: dto.eposta } });
    if (mevcut) throw new BadRequestException('Bu e-posta zaten kayıtlı');

    // Şube atamaları kullanıcının yetkisinde olmalı
    if (dto.subeIds?.length) {
      for (const sid of dto.subeIds) subeYetkiKontrolu(user, sid);
    }

    const sifreHash = await bcrypt.hash(dto.sifre, 10);
    const kullanici = await this.prisma.$transaction(async (tx) => {
      const k = await tx.kullanici.create({
        data: {
          eposta: dto.eposta,
          sifreHash,
          adSoyad: dto.adSoyad,
          telefon: dto.telefon,
          rol: dto.rol,
          subeler: dto.subeIds?.length
            ? { create: dto.subeIds.map((subeId) => ({ subeId })) }
            : undefined,
        },
        include: { subeler: { include: { sube: true } } },
      });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.KULLANICI_OLUSTUR,
        entityTipi: 'Kullanici',
        entityId: k.id,
        ozet: `Yeni kullanıcı: ${k.adSoyad} (${k.eposta}) — rol ${k.rol}`,
        sonraki: { eposta: k.eposta, rol: k.rol, subeIds: dto.subeIds || [] },
      });
      return k;
    });
    return this.maskele(kullanici);
  }

  async guncelle(id: string, dto: KullaniciUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    const data: any = {};
    if (dto.adSoyad !== undefined) data.adSoyad = dto.adSoyad;
    if (dto.telefon !== undefined) data.telefon = dto.telefon;
    if (dto.aktif !== undefined) data.aktif = dto.aktif;
    const rolDegisti = dto.rol !== undefined && dto.rol !== mevcut.rol;
    if (dto.rol !== undefined) {
      if (dto.rol === Rol.SUPER_ADMIN && user.rol !== Rol.SUPER_ADMIN) {
        throw new ForbiddenException();
      }
      data.rol = dto.rol;
    }
    if (dto.yeniSifre) data.sifreHash = await bcrypt.hash(dto.yeniSifre, 10);

    return this.prisma.$transaction(async (tx) => {
      if (dto.subeIds) {
        for (const sid of dto.subeIds) subeYetkiKontrolu(user, sid);
        await tx.subeKullanici.deleteMany({ where: { kullaniciId: id } });
        for (const subeId of dto.subeIds) {
          await tx.subeKullanici.create({ data: { kullaniciId: id, subeId } });
        }
      }

      const guncel = await tx.kullanici.update({
        where: { id },
        data,
        include: { subeler: { include: { sube: true } } },
      });

      if (rolDegisti) {
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.KULLANICI_ROL_DEGISTI,
          entityTipi: 'Kullanici',
          entityId: id,
          ozet: `${mevcut.adSoyad}: ${mevcut.rol} → ${dto.rol}`,
          onceki: { rol: mevcut.rol },
          sonraki: { rol: dto.rol },
        });
      }
      return this.maskele(guncel);
    });
  }

  async sil(id: string, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (id === user.kullaniciId) throw new BadRequestException('Kendinizi silemezsiniz');
    return this.prisma.$transaction(async (tx) => {
      await tx.kullanici.update({
        where: { id },
        data: { aktif: false },
      });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.KULLANICI_PASIFLESTIR,
        entityTipi: 'Kullanici',
        entityId: id,
        ozet: `Kullanıcı pasifleştirildi: ${mevcut.adSoyad} (${mevcut.eposta})`,
        onceki: { aktif: true, rol: mevcut.rol },
        sonraki: { aktif: false },
      });
      return { silindi: true };
    });
  }

  async kuryeListesi(user: CurrentUserData, subeId: string) {
    subeYetkiKontrolu(user, subeId);
    return this.prisma.kullanici.findMany({
      where: {
        rol: Rol.KURYE,
        aktif: true,
        subeler: { some: { subeId } },
      },
      select: { id: true, adSoyad: true, telefon: true },
      orderBy: { adSoyad: 'asc' },
    });
  }
}
