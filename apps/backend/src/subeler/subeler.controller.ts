import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubelerService } from './subeler.service';
import { SubeCreateDto, SubeUpdateDto } from './dto/sube.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('subeler')
@UseGuards(JwtAuthGuard)
export class SubelerController {
  constructor(private subeler: SubelerService) {}

  @Get()
  liste(@CurrentUser() user: CurrentUserData) {
    return this.subeler.liste(user);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.subeler.getir(id, user);
  }

  @Post()
  olustur(@Body() dto: SubeCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.subeler.olustur(dto, user);
  }

  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: SubeUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.subeler.guncelle(id, dto, user);
  }

  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.subeler.sil(id, user);
  }
}
