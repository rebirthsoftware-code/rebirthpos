import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MasaCreateDto {
  @IsString() @MaxLength(120) subeId!: string;
  @IsOptional() @IsString() katId?: string;
  @IsString() @MaxLength(40) ad!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) kapasite?: number;
  @IsOptional() @IsIn(['BOS', 'DOLU', 'REZERVE', 'ODEME_BEKLIYOR']) durum?: string;
  @IsOptional() @Type(() => Number) @IsNumber() pozisyonX?: number;
  @IsOptional() @Type(() => Number) @IsNumber() pozisyonY?: number;
}

export class MasaUpdateDto {
  @IsOptional() @IsString() katId?: string | null;
  @IsOptional() @IsString() @MaxLength(40) ad?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) kapasite?: number;
  @IsOptional() @IsIn(['BOS', 'DOLU', 'REZERVE', 'ODEME_BEKLIYOR']) durum?: string;
  @IsOptional() @Type(() => Number) @IsNumber() pozisyonX?: number;
  @IsOptional() @Type(() => Number) @IsNumber() pozisyonY?: number;
}
