import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateLuminariaMapaDto {
  @IsString()
  luminariaId: string;

  @IsString()
  nombre: string;

  @IsNumber()
  @Min(0)
  numero: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @IsOptional()
  @IsString()
  conjuntoId?: string;
}
