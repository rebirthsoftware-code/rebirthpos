import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StokHareketDto {
  @IsString() urunId!: string;
  @IsIn(['GIRIS', 'CIKIS', 'DUZELTME', 'FIRE', 'IADE'])
  tip!: string;
  @Type(() => Number) @IsNumber() miktar!: number; // pozitif sayı, tip yönü belirler
  @IsOptional() @IsString() @MaxLength(300) aciklama?: string;
}

export class TopluStokKalemDto {
  @IsString() urunId!: string;
  @Type(() => Number) @IsNumber() @Min(0) miktar!: number;
}

// Barkod okutarak toplu giriş / çıkış / fire / sayım — tek işlemde (transaction)
export class TopluStokHareketDto {
  @IsString() subeId!: string;
  @IsIn(['GIRIS', 'CIKIS', 'DUZELTME', 'FIRE', 'IADE'])
  tip!: string;
  @IsOptional() @IsString() @MaxLength(300) aciklama?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => TopluStokKalemDto)
  kalemler!: TopluStokKalemDto[];
}
