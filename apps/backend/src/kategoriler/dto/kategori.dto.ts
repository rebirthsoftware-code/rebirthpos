import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class KategoriCreateDto {
  @IsString() @MaxLength(120) subeId!: string;
  @IsString() @MaxLength(120) ad!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sira?: number;
  @IsOptional() @IsString() @MaxLength(20) renk?: string;
  @IsOptional() @IsString() @MaxLength(60) ikon?: string;
  @IsOptional() @IsBoolean() aktif?: boolean;
}

export class KategoriUpdateDto {
  @IsOptional() @IsString() @MaxLength(120) ad?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sira?: number;
  @IsOptional() @IsString() @MaxLength(20) renk?: string;
  @IsOptional() @IsString() @MaxLength(60) ikon?: string;
  @IsOptional() @IsBoolean() aktif?: boolean;
}
