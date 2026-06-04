import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { DenetimService } from './denetim.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { Rol } from '../common/enums';

@Controller('denetim')
@UseGuards(JwtAuthGuard)
export class DenetimController {
  constructor(private denetim: DenetimService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('islem') islem?: string,
    @Query('entityTipi') entityTipi?: string,
    @Query('entityId') entityId?: string,
    @Query('kullaniciId') kullaniciId?: string,
    @Query('tarihBas') tarihBas?: string,
    @Query('tarihSon') tarihSon?: string,
    @Query('limit') limit?: string,
  ) {
    // Denetim kayıtları yalnız yönetici rolleri için
    if (
      user.rol !== Rol.SUPER_ADMIN &&
      user.rol !== Rol.FIRMA_ADMIN &&
      user.rol !== Rol.SUBE_MUDURU
    ) {
      throw new ForbiddenException('Denetim kayıtlarını sadece yöneticiler görebilir');
    }
    return this.denetim.liste(user, {
      subeId,
      islem,
      entityTipi,
      entityId,
      kullaniciId,
      tarihBas,
      tarihSon,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
