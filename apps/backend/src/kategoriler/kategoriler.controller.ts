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
import { KategorilerService } from './kategoriler.service';
import { KategoriCreateDto, KategoriUpdateDto } from './dto/kategori.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('kategoriler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KategorilerController {
  constructor(private kategoriler: KategorilerService) {}

  @Get()
  liste(@CurrentUser() user: CurrentUserData, @Query('subeId') subeId?: string) {
    return this.kategoriler.liste(user, subeId);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.kategoriler.getir(id, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Post()
  olustur(@Body() dto: KategoriCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.kategoriler.olustur(dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: KategoriUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.kategoriler.guncelle(id, dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.kategoriler.sil(id, user);
  }
}
