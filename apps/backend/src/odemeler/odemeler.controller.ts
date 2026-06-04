import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OdemelerService } from './odemeler.service';
import { KartlaOdeDto, OdemeOlusturDto } from './dto/odeme.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('odemeler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OdemelerController {
  constructor(private odemeler: OdemelerService) {}

  // Ödeme alma: KASIYER yapar — guard yok.
  @Post()
  olustur(@Body() dto: OdemeOlusturDto, @CurrentUser() user: CurrentUserData) {
    return this.odemeler.olustur(dto, user);
  }

  // Atomik kart ödemesi: validate → POS çek → Odeme kaydı, hepsi tek istekte.
  // POS başarılı olduktan sonra DB hatası olursa otomatik iade çağrılır.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('kartla-ode')
  kartlaOde(@Body() dto: KartlaOdeDto, @CurrentUser() user: CurrentUserData) {
    return this.odemeler.kartlaOde(dto, user);
  }

  // Ödeme iptali (para iadesi): yönetici. KASIYER tek başına iade yapamaz.
  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  iptal(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.odemeler.iptal(id, user);
  }
}
