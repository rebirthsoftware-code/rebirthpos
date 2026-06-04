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
import { KatlarService } from './katlar.service';
import { KatCreateDto, KatUpdateDto } from './dto/kat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('katlar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KatlarController {
  constructor(private katlar: KatlarService) {}

  @Get()
  liste(@CurrentUser() user: CurrentUserData, @Query('subeId') subeId?: string) {
    return this.katlar.liste(user, subeId);
  }

  @Roles(...YONETICI_ROLLER)
  @Post()
  olustur(@Body() dto: KatCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.katlar.olustur(dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: KatUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.katlar.guncelle(id, dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.katlar.sil(id, user);
  }
}
