import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SiparislerService } from './siparisler.service';
import { SiparisOlusturDto } from './dto/siparis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { IsIn, IsString } from 'class-validator';

class SiparisDurumDto {
  @IsIn(['ALINDI', 'HAZIRLANIYOR', 'HAZIR', 'TESLIM_EDILDI', 'IPTAL'])
  @IsString()
  durum!: string;
}

@Controller('siparisler')
@UseGuards(JwtAuthGuard)
export class SiparislerController {
  constructor(private siparisler: SiparislerService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('durumlar') durumlar?: string,
  ) {
    return this.siparisler.listele(user, subeId, durumlar?.split(','));
  }

  @Post()
  olustur(@Body() dto: SiparisOlusturDto, @CurrentUser() user: CurrentUserData) {
    return this.siparisler.olustur(dto, user);
  }

  @Delete('kalem/:id')
  kalemIptal(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.siparisler.kalemIptal(id, user);
  }

  @Patch(':id/durum')
  durumGuncelle(
    @Param('id') id: string,
    @Body() dto: SiparisDurumDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.siparisler.durumGuncelle(id, dto.durum, user);
  }
}
