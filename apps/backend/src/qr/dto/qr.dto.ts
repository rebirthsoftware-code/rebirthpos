import { IsArray, IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
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

// QR menüden masa hesabı için PayTR sanal pos ödemesini başlatır.
export class QrOdemeBaslatDto {
  @IsString() subeId!: string;
  @IsString() adisyonId!: string;
  // Ödenecek tutar (TL) — kalan bakiyeyi aşamaz, backend doğrular.
  @Type(() => Number) @IsNumber() @Min(0.01) tutar!: number;
  @IsOptional() @IsString() @MaxLength(120) musteriAd?: string;
  @IsOptional() @IsEmail() @MaxLength(160) musteriEposta?: string;
  @IsOptional() @IsString() @MaxLength(30) musteriTel?: string;
}

// PayTR sanal pos ödeme sonucunu işler ve onaylandıysa Odeme kaydı oluşturur.
export class QrOdemeSonucDto {
  @IsString() subeId!: string;
  @IsString() adisyonId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) tutar!: number;
  @IsString() @MaxLength(120) token!: string;
  // Müşterinin test ödeme sayfasında seçtiği sonuç (MOCK akışı).
  @IsOptional() @IsBoolean() basariliMi?: boolean;
}
