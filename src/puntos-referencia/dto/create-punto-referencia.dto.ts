import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsNumber, IsLatitude, IsLongitude } from 'class-validator';

/**
 * DTO para crear un nuevo punto de referencia
 */
export class CreatePuntoReferenciaDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código es requerido' })
  @MinLength(1, { message: 'El código no puede estar vacío' })
  @MaxLength(10, { message: 'El código no puede exceder 10 caracteres' })
  codigo: string;

  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @IsLatitude({ message: 'La latitud debe ser un valor válido entre -90 y 90' })
  latitud: number;

  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @IsLongitude({ message: 'La longitud debe ser un valor válido entre -180 y 180' })
  longitud: number;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string | null;

  @IsOptional()
  @IsString({ message: 'El tipo debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El tipo no puede exceder 50 caracteres' })
  tipo?: string | null;
}
