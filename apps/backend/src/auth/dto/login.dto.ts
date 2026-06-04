import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta giriniz' })
  eposta!: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  sifre!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
