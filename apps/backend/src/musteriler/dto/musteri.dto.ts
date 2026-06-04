import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class MusteriCreateDto {
  @IsString() subeId!: string;
  @IsString() @MaxLength(120) adSoyad!: string;
  @IsString() @MaxLength(30) telefon!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(500) adres?: string;
  @IsOptional() @IsString() @MaxLength(500) notlar?: string;
}

export class MusteriUpdateDto {
  @IsOptional() @IsString() @MaxLength(120) adSoyad?: string;
  @IsOptional() @IsString() @MaxLength(30) telefon?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(500) adres?: string;
  @IsOptional() @IsString() @MaxLength(500) notlar?: string;
}
