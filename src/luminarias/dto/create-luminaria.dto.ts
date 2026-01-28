import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsIn } from 'class-validator';

/**
 * DTO para crear una nueva luminaria
 */
export class CreateLuminariaDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(1, { message: 'El nombre no puede estar vacío' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @IsString({ message: 'El topic debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El topic es requerido' })
  @MinLength(1, { message: 'El topic no puede estar vacío' })
  @MaxLength(500, { message: 'El topic no puede exceder 500 caracteres' })
  topic: string;

  @IsOptional()
  @IsString({ message: 'El tipo de dispositivo debe ser una cadena de texto' })
  @IsIn(['RPI', 'PLC_S', 'PLC_N'], { message: 'El tipo de dispositivo debe ser RPI, PLC_S o PLC_N' })
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N';
}

