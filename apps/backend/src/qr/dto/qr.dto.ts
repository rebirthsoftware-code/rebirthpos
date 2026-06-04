import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QrKalemDto {
  @IsString() urunId!: string;
  @Type(() => Number) @IsInt() @Min(1) adet!: number;
  @IsOptional() @IsString() @MaxLength(200) not?: string;
}

export class QrSiparisDto {
  @IsString() subeId!: string;
  @IsOptional() @IsString() masaId?: string;
  @IsOptional() @IsString() @MaxLength(120) musteriAd?: string;
  @IsOptional() @IsString() @MaxLength(30) musteriTel?: string;
  @IsOptional() @IsString() @MaxLength(500) not?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QrKalemDto)
  kalemler!: QrKalemDto[];
}
