import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';

/**
 * DTO para crear una nueva barrera
 */
export class CreateBarreraDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsString({ message: 'El topic debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El topic es requerido' })
  @MinLength(1, { message: 'El topic no puede estar vacío' })
  @MaxLength(255, { message: 'El topic no puede exceder 255 caracteres' })
  topic: string;

  @IsString({ message: 'La URL de la cámara debe ser una cadena de texto' })
  @IsOptional()
  @MaxLength(500, { message: 'La URL no puede exceder 500 caracteres' })
  urlCamara?: string;

  @IsString({ message: 'El comando de abrir debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El comando de abrir es requerido' })
  @MinLength(1, { message: 'El comando de abrir no puede estar vacío' })
  comandoAbrir: string;

  @IsString({ message: 'El comando de cerrar debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El comando de cerrar es requerido' })
  @MinLength(1, { message: 'El comando de cerrar no puede estar vacío' })
  comandoCerrar: string;

  @IsString({ message: 'El comando de estado debe ser una cadena de texto' })
  @IsOptional()
  @MinLength(1, { message: 'El comando de estado no puede estar vacío' })
  comandoEstado?: string;
}

