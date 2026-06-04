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
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EBelgeService } from './e-belge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { EBelgeTip } from './e-belge.types';

class AliciDto {
  @IsString() @Length(2, 200) ad!: string;
  @IsOptional() @IsString() @Length(10, 11) vergiNo?: string;
  @IsOptional() @IsString() vergiDairesi?: string;
  @IsOptional() @IsString() adres?: string;
  @IsOptional() @IsEmail() eposta?: string;
  @IsOptional() @IsString() telefon?: string;
}

class FaturaDuzenleDto {
  @IsIn(['E_ARSIV', 'E_FATURA', 'E_SMM'])
  tip!: EBelgeTip;

  @Type(() => AliciDto)
  alici!: AliciDto;

  @IsOptional() @IsString() not?: string;
}

class IptalDto {
  @IsOptional() @IsString() sebep?: string;
}

@Controller('e-belge')
@UseGuards(JwtAuthGuard)
export class EBelgeController {
  constructor(private ebelge: EBelgeService) {}

  @Get('durum')
  durum() {
    return this.ebelge.durum();
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('fatura-duzenle/:adisyonId')
  faturaDuzenle(
    @Param('adisyonId') adisyonId: string,
    @Body() dto: FaturaDuzenleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ebelge.adisyonaFaturaDuzenle(adisyonId, dto.tip, dto.alici, dto.not, user);
  }

  @Get()
  liste(
    @Query('subeId') subeId?: string,
    @Query('tip') tip?: EBelgeTip,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? Math.min(500, Math.max(1, Number(limitStr))) : 100;
    return this.ebelge.listele(subeId, tip, limit);
  }

  @Get(':id')
  detay(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.ebelge.detay(id, user);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/iptal')
  iptal(
    @Param('id') id: string,
    @Body() dto: IptalDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ebelge.iptal(id, dto.sebep, user);
  }
}
