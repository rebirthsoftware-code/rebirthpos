import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubeCreateDto {
  @IsString() @MaxLength(120)
  firmaId!: string;

  @IsString() @MaxLength(120)
  ad!: string;

  @IsOptional() @IsString() @MaxLength(255)
  adres?: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefon?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsBoolean()
  aktif?: boolean;
}

export class SubeUpdateDto {
  @IsOptional() @IsString() @MaxLength(120)
  ad?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adres?: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefon?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsBoolean()
  aktif?: boolean;
}
