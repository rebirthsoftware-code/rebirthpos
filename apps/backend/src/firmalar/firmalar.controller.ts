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
import { FirmalarService } from './firmalar.service';
import { FirmaCreateDto, FirmaUpdateDto } from './dto/firma.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Rol } from '../common/enums';

@Controller('firmalar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.SUPER_ADMIN)
export class FirmalarController {
  constructor(private firmalar: FirmalarService) {}

  @Get()
  liste() {
    return this.firmalar.liste();
  }

  @Get(':id')
  getir(@Param('id') id: string) {
    return this.firmalar.getir(id);
  }

  @Post()
  olustur(@Body() dto: FirmaCreateDto) {
    return this.firmalar.olustur(dto);
  }

  @Patch(':id')
  guncelle(@Param('id') id: string, @Body() dto: FirmaUpdateDto) {
    return this.firmalar.guncelle(id, dto);
  }

  @Delete(':id')
  sil(@Param('id') id: string) {
    return this.firmalar.sil(id);
  }
}
