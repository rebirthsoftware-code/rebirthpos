import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { StokService } from './stok.service';
import { StokHareketDto } from './dto/stok.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('stok')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StokController {
  constructor(private stok: StokService) {}

  @Get('durum')
  durum(@CurrentUser() user: CurrentUserData, @Query('subeId') subeId?: string) {
    return this.stok.stokDurumu(user, subeId);
  }

  @Get('hareketler')
  hareketler(
    @CurrentUser() user: CurrentUserData,
    @Query('urunId') urunId?: string,
    @Query('subeId') subeId?: string,
  ) {
    return this.stok.hareketler(user, urunId, subeId);
  }

  // Manuel stok düzeltme (GIRIS/CIKIS/FIRE/DUZELTME): yönetici.
  // Otomatik SATIS hareketleri sipariş flow'undan gelir, bu endpoint dışında.
  @Roles(...YONETICI_ROLLER)
  @Post('hareket')
  hareket(@Body() dto: StokHareketDto, @CurrentUser() user: CurrentUserData) {
    return this.stok.hareketEkle(dto, user);
  }
}
