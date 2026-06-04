import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class KalemEkleDto {
  @IsString() urunId!: string;
  @Type(() => Number) @IsInt() @Min(1) adet!: number;
  @IsOptional() @IsString() @MaxLength(300) not?: string;
}

export class SiparisOlusturDto {
  @IsString() adisyonId!: string;
  @IsOptional() @IsString() @MaxLength(40) kaynak?: string; // PANEL | QR_MENU | TELEFON
  @IsOptional() @IsString() @MaxLength(500) not?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => KalemEkleDto)
  kalemler!: KalemEkleDto[];
}
