import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubeCreateDto, SubeUpdateDto } from './dto/sube.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { Rol } from '../common/enums';

@Injectable()
export class SubelerService {
  constructor(private prisma: PrismaService) {}

  async liste(user: CurrentUserData) {
    const erisim = erisilebilirSubeler(user);
    return this.prisma.sube.findMany({
      where: erisim.hepsi ? {} : { id: { in: erisim.ids } },
      include: {
        firma: { select: { id: true, ad: true } },
        _count: { select: { masalar: true, urunler: true, kullanicilar: true } },
      },
      orderBy: [{ firma: { ad: 'asc' } }, { ad: 'asc' }],
    });
  }

  async getir(id: string, user: CurrentUserData) {
    subeYetkiKontrolu(user, id);
    const sube = await this.prisma.sube.findUnique({
      where: { id },
      include: { firma: true },
    });
    if (!sube) throw new NotFoundException('Şube bulunamadı');
    return sube;
  }

  async olustur(dto: SubeCreateDto, user: CurrentUserData) {
    // Sadece SUPER_ADMIN ve FIRMA_ADMIN şube oluşturabilir
    if (user.rol !== Rol.SUPER_ADMIN && user.rol !== Rol.FIRMA_ADMIN) {
      throw new ForbiddenException('Şube oluşturma yetkiniz yok');
    }
    const firma = await this.prisma.firma.findUnique({ where: { id: dto.firmaId } });
    if (!firma) throw new NotFoundException('Firma bulunamadı');
    return this.prisma.sube.create({ data: dto, include: { firma: true } });
  }

  async guncelle(id: string, dto: SubeUpdateDto, user: CurrentUserData) {
    await this.getir(id, user);
    return this.prisma.sube.update({
      where: { id },
      data: dto,
      include: { firma: true },
    });
  }

  async sil(id: string, user: CurrentUserData) {
    if (user.rol !== Rol.SUPER_ADMIN && user.rol !== Rol.FIRMA_ADMIN) {
      throw new ForbiddenException('Şube silme yetkiniz yok');
    }
    await this.getir(id, user);
    await this.prisma.sube.delete({ where: { id } });
    return { silindi: true };
  }
}
