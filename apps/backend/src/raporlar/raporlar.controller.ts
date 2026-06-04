import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RaporlarService } from './raporlar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

// Raporlar: ciro/kâr bilgisi içerir — sadece yöneticilere.
@Controller('raporlar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...YONETICI_ROLLER)
export class RaporlarController {
  constructor(private raporlar: RaporlarService) {}

  @Get('gunsonu')
  gunSonu(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('tarih') tarih?: string,
  ) {
    return this.raporlar.gunSonu(user, subeId, tarih);
  }

  @Get('aylik')
  aylik(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('ay') ay?: string,
  ) {
    return this.raporlar.aylikOzet(user, subeId, ay);
  }

  @Get('personel')
  personel(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('tarih') tarih?: string,
  ) {
    return this.raporlar.personelPerformans(user, subeId, tarih);
  }
}
