import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaketService } from './paket.service';
import { KuryeAtamaDto, PaketDurumDto, PaketOlusturDto } from './dto/paket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('paket')
@UseGuards(JwtAuthGuard)
export class PaketController {
  constructor(private paket: PaketService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('durum') durum?: string,
  ) {
    return this.paket.liste(user, subeId, durum);
  }

  @Post()
  olustur(@Body() dto: PaketOlusturDto, @CurrentUser() user: CurrentUserData) {
    return this.paket.olustur(dto, user);
  }

  @Patch(':id/kurye')
  kuryeAta(@Param('id') id: string, @Body() dto: KuryeAtamaDto, @CurrentUser() user: CurrentUserData) {
    return this.paket.kuryeAta(id, dto.kuryeId, user);
  }

  @Patch(':id/durum')
  durum(@Param('id') id: string, @Body() dto: PaketDurumDto, @CurrentUser() user: CurrentUserData) {
    return this.paket.paketDurumGuncelle(id, dto.paketDurum, user);
  }
}
