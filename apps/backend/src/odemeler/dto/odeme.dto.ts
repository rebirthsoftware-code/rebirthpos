import { IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// URUN_SEC modunda ödenmiş kalem adetleri.
// Split-bill: müşteri A 3 pizzanın 1'ini öder → { kalemId, adet: 1 }
export class OdenenKalemDto {
  @IsString() kalemId!: string;
  @Type(() => Number) @IsInt() @Min(1) adet!: number;
}

export class OdemeOlusturDto {
  @IsString() adisyonId!: string;

  @IsIn(['NAKIT', 'KREDI_KARTI', 'SANAL_POS', 'YEMEKSEPETI', 'TICKET'])
  tip!: string;

  @Type(() => Number) @IsNumber() @Min(0.01) tutar!: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bahsis?: number;

  // İstemci tarafından üretilen UUID. Aynı key ile gelen ikinci istek aynı
  // ödemeyi döner — çift tıklama / retry sırasında mükerrer kayıt oluşmaz.
  @IsOptional() @IsString() @Length(8, 64) idempotencyKey?: string;

  // POS kart cihazından dönen slip bilgisi (yalnız KREDI_KARTI). JSON olarak DB'ye
  // kartMeta kolonuna yazılır. Şekil: { slipNo, rrn, banka, sonRakam, onayKod, terminalMarka }
  @IsOptional() @IsObject() kartMeta?: Record<string, unknown>;

  // URUN_SEC modunda kullanılır: bu ödeme hangi kalemlerin kaç adedini kapsar.
  // Verilirse: backend kalem adetlerini günceller (odenenAdet artar), tutar kalem
  // toplamlarıyla doğrulanır. Verilmezse: klasik tam/karma akış.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OdenenKalemDto)
  odenenKalemler?: OdenenKalemDto[];
}

export class KartlaOdeDto {
  @IsString() adisyonId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) tutar!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) bahsis?: number;
  @IsOptional() @IsString() @Length(8, 64) idempotencyKey?: string;
  @IsOptional() @IsString() referans?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OdenenKalemDto)
  odenenKalemler?: OdenenKalemDto[];
}
