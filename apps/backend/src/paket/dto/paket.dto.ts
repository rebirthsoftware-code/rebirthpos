import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PaketKalemDto {
  @IsString() urunId!: string;
  @Type(() => Number) @IsInt() @Min(1) adet!: number;
  @IsOptional() @IsString() @MaxLength(300) not?: string;
}

export class PaketOlusturDto {
  @IsString() subeId!: string;
  @IsString() @MaxLength(120) musteriAdSoyad!: string;
  @IsString() @MaxLength(30) musteriTelefon!: string;
  @IsOptional() @IsString() @MaxLength(500) adres?: string;
  @IsOptional() @IsString() @MaxLength(500) not?: string;
  @IsOptional() @IsIn(['PAKET', 'GEL_AL']) tip?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaketKalemDto)
  kalemler!: PaketKalemDto[];
}

export class KuryeAtamaDto {
  @IsString() kuryeId!: string;
}

export class PaketDurumDto {
  @IsIn(['BEKLIYOR', 'HAZIRLANIYOR', 'YOLDA', 'TESLIM_EDILDI'])
  paketDurum!: string;
}
