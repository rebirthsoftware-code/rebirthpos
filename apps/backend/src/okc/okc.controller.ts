import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OkcService } from './okc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { YONETICI_ROLLER } from '../common/enums';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

class IadeDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) tutar?: number;
}

@Controller('okc')
@UseGuards(JwtAuthGuard)
export class OkcController {
  constructor(private okc: OkcService) {}

  @Get('durum')
  durum() {
    return this.okc.durum();
  }

  // Fiş kesme — agresif istemci retry'ları için throttle.
  // Idempotency service tarafında.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('satis/:adisyonId')
  satis(@Param('adisyonId') adisyonId: string, @CurrentUser() user: CurrentUserData) {
    return this.okc.satisGonder(adisyonId, user);
  }

  /**
   * Ödeme bazlı fiş kesme: her ödeme kendi mali fişini alır.
   * 27000₺ adisyonda 26820 KART + 180 NAKİT → 2 ayrı fiş (KDV orantısal).
   */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('odeme-fis/:odemeId')
  odemeFisi(@Param('odemeId') odemeId: string, @CurrentUser() user: CurrentUserData) {
    return this.okc.odemeFisiKes(odemeId, user);
  }

  // ── GİB Raporları — yalnız yönetici ──
  @UseGuards(RolesGuard)
  @Roles(...YONETICI_ROLLER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('x-raporu')
  xRaporu(@CurrentUser() user: CurrentUserData, @Query('subeId') subeId?: string) {
    return this.okc.xRaporuAl(user, subeId);
  }

  @UseGuards(RolesGuard)
  @Roles(...YONETICI_ROLLER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('z-raporu')
  zRaporu(@CurrentUser() user: CurrentUserData, @Query('subeId') subeId?: string) {
    return this.okc.zRaporuAl(user, subeId);
  }

  @UseGuards(RolesGuard)
  @Roles(...YONETICI_ROLLER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('iade/:odemeId')
  iade(
    @Param('odemeId') odemeId: string,
    @Body() dto: IadeDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.okc.iade(odemeId, dto.tutar, user);
  }
}
