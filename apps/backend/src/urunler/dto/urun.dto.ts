import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UrunCreateDto {
  @IsString() @MaxLength(120) subeId!: string;
  @IsOptional() @IsString() kategoriId?: string;
  @IsString() @MaxLength(180) ad!: string;
  @IsOptional() @IsString() @MaxLength(500) aciklama?: string;
  @Type(() => Number) @IsNumber() @Min(0) fiyat!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kdvOrani?: number;
  @IsOptional() @IsString() resimUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) barkod?: string;
  @IsOptional() @IsBoolean() stokTakibi?: boolean;
  @IsOptional() @IsBoolean() aktif?: boolean;
  @IsOptional() @IsBoolean() qrMenudeGoster?: boolean;
}

export class UrunUpdateDto {
  @IsOptional() @IsString() kategoriId?: string | null;
  @IsOptional() @IsString() @MaxLength(180) ad?: string;
  @IsOptional() @IsString() @MaxLength(500) aciklama?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) fiyat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) kdvOrani?: number;
  @IsOptional() @IsString() resimUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) barkod?: string;
  @IsOptional() @IsBoolean() stokTakibi?: boolean;
  @IsOptional() @IsBoolean() aktif?: boolean;
  @IsOptional() @IsBoolean() qrMenudeGoster?: boolean;
}
