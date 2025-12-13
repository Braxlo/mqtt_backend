import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  MaxLength,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

/**
 * DTO para crear un nuevo botón de escenario
 */
export class CreateEscenarioDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsArray({ message: 'topics1 debe ser un array' })
  @IsString({ each: true, message: 'Cada topic debe ser una cadena de texto' })
  topics1: string[];

  @IsString({ message: 'El mensaje1 debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El mensaje1 es requerido' })
  @MinLength(1, { message: 'El mensaje1 no puede estar vacío' })
  mensaje1: string;

  @IsArray({ message: 'topics2 debe ser un array' })
  @IsString({ each: true, message: 'Cada topic debe ser una cadena de texto' })
  topics2: string[];

  @IsString({ message: 'El mensaje2 debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El mensaje2 es requerido' })
  @MinLength(1, { message: 'El mensaje2 no puede estar vacío' })
  mensaje2: string;

  @IsString({ message: 'El color debe ser una cadena de texto' })
  @IsOptional()
  @MaxLength(50, { message: 'El color no puede exceder 50 caracteres' })
  color?: string;
}

