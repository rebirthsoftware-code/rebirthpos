import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class KullaniciCreateDto {
  @IsEmail() eposta!: string;
  @IsString() @MinLength(6) sifre!: string;
  @IsString() @MaxLength(120) adSoyad!: string;
  @IsOptional() @IsString() @MaxLength(30) telefon?: string;
  @IsIn(['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU', 'KASIYER', 'GARSON', 'MUTFAK', 'KURYE'])
  rol!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) subeIds?: string[];
}

export class KullaniciUpdateDto {
  @IsOptional() @IsString() @MaxLength(120) adSoyad?: string;
  @IsOptional() @IsString() @MaxLength(30) telefon?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU', 'KASIYER', 'GARSON', 'MUTFAK', 'KURYE'])
  rol?: string;
  @IsOptional() @IsBoolean() aktif?: boolean;
  @IsOptional() @IsString() @MinLength(6) yeniSifre?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) subeIds?: string[];
}
