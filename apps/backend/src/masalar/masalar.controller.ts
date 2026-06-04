import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MasalarService } from './masalar.service';
import { MasaCreateDto, MasaUpdateDto } from './dto/masa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('masalar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasalarController {
  constructor(private masalar: MasalarService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('katId') katId?: string,
  ) {
    return this.masalar.liste(user, subeId, katId);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.masalar.getir(id, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Post()
  olustur(@Body() dto: MasaCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.masalar.olustur(dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: MasaUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.masalar.guncelle(id, dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.masalar.sil(id, user);
  }
}
