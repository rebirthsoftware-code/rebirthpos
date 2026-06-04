import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class KatCreateDto {
  @IsString() @MaxLength(120) subeId!: string;
  @IsString() @MaxLength(60) ad!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sira?: number;
}

export class KatUpdateDto {
  @IsOptional() @IsString() @MaxLength(60) ad?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sira?: number;
}
