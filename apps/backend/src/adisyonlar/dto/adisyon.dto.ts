import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdisyonAcDto {
  @IsString() @MaxLength(120) subeId!: string;
  @IsOptional() @IsString() masaId?: string;
  @IsOptional() @IsString() @MaxLength(500) not?: string;
}

export class AdisyonGuncelleDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) iskontoTutar?: number;
  @IsOptional() @IsString() @MaxLength(500) not?: string;
}

export class AdisyonDurumDto {
  @IsIn(['ACIK', 'ODEME_BEKLIYOR', 'KAPALI', 'IPTAL'])
  durum!: string;
}
