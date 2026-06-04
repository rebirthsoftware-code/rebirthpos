import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler } from '../common/tenant';
import { DenetimOlay } from './denetim.olay';

export interface DenetimKayitGirdi {
  islem: DenetimOlay;
  entityTipi: string;
  entityId?: string | null;
  subeId?: string | null;
  ozet?: string;
  onceki?: unknown;
  sonraki?: unknown;
  ip?: string | null;
}

// Prisma transaction client (tx) ya da direkt PrismaService kullanılabilir.
type PrismaLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class DenetimService {
  constructor(private prisma: PrismaService) {}

  /**
   * Audit kaydı oluştur. İdeali transaction içinde kullanmak — ana işlemle
   * birlikte yazılır, ana işlem rollback olursa kayıt da geri alınır.
   *
   * @param db Prisma instance veya transaction client
   * @param user Olayı yapan kullanıcı (kim?)
   * @param girdi Olay detayları
   */
  async kaydet(db: PrismaLike, user: CurrentUserData | null, girdi: DenetimKayitGirdi) {
    return (db as PrismaService).denetim.create({
      data: {
        islem: girdi.islem,
        entityTipi: girdi.entityTipi,
        entityId: girdi.entityId ?? null,
        subeId: girdi.subeId ?? null,
        kullaniciId: user?.kullaniciId ?? null,
        ozet: girdi.ozet ?? null,
        onceki: girdi.onceki !== undefined ? JSON.stringify(girdi.onceki) : null,
        sonraki: girdi.sonraki !== undefined ? JSON.stringify(girdi.sonraki) : null,
        ip: girdi.ip ?? null,
      },
    });
  }

  async liste(
    user: CurrentUserData,
    filtreler: {
      subeId?: string;
      islem?: string;
      entityTipi?: string;
      entityId?: string;
      kullaniciId?: string;
      tarihBas?: string;
      tarihSon?: string;
      limit?: number;
    } = {},
  ) {
    const erisim = erisilebilirSubeler(user);
    const where: Prisma.DenetimWhereInput = {};

    if (filtreler.subeId) {
      // Şube filtresi varsa yetki kontrolü
      if (!erisim.hepsi && !erisim.ids.includes(filtreler.subeId)) {
        return [];
      }
      where.subeId = filtreler.subeId;
    } else if (!erisim.hepsi) {
      // Kullanıcının erişebildiği şubelerle sınırla (subeId=null olanları da göster)
      where.OR = [{ subeId: { in: erisim.ids } }, { subeId: null }];
    }

    if (filtreler.islem) where.islem = filtreler.islem;
    if (filtreler.entityTipi) where.entityTipi = filtreler.entityTipi;
    if (filtreler.entityId) where.entityId = filtreler.entityId;
    if (filtreler.kullaniciId) where.kullaniciId = filtreler.kullaniciId;
    if (filtreler.tarihBas || filtreler.tarihSon) {
      where.olusturuldu = {};
      if (filtreler.tarihBas) (where.olusturuldu as any).gte = new Date(filtreler.tarihBas);
      if (filtreler.tarihSon) (where.olusturuldu as any).lt = new Date(filtreler.tarihSon);
    }

    return this.prisma.denetim.findMany({
      where,
      include: {
        kullanici: { select: { id: true, adSoyad: true, eposta: true, rol: true } },
        sube: { select: { id: true, ad: true } },
      },
      orderBy: { olusturuldu: 'desc' },
      take: Math.min(filtreler.limit || 200, 1000),
    });
  }
}
