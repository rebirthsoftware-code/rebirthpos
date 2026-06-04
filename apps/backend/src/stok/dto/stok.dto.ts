import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class StokHareketDto {
  @IsString() urunId!: string;
  @IsIn(['GIRIS', 'CIKIS', 'DUZELTME', 'FIRE', 'IADE'])
  tip!: string;
  @Type(() => Number) @IsNumber() miktar!: number; // pozitif sayı, tip yönü belirler
  @IsOptional() @IsString() @MaxLength(300) aciklama?: string;
}
