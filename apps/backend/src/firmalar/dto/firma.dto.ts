import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class FirmaCreateDto {
  @IsString()
  @MaxLength(120)
  ad!: string;

  @IsOptional() @IsString() @MaxLength(20)
  vergiNo?: string;

  @IsOptional() @IsString() @MaxLength(120)
  vergiDairesi?: string;

  @IsOptional() @IsString()
  logoUrl?: string;

  @IsOptional() @IsString() @MaxLength(8)
  paraBirimi?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  kdvOrani?: number;
}

export class FirmaUpdateDto {
  @IsOptional() @IsString() @MaxLength(120)
  ad?: string;

  @IsOptional() @IsString() @MaxLength(20)
  vergiNo?: string;

  @IsOptional() @IsString() @MaxLength(120)
  vergiDairesi?: string;

  @IsOptional() @IsString()
  logoUrl?: string;

  @IsOptional() @IsString() @MaxLength(8)
  paraBirimi?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  kdvOrani?: number;
}
