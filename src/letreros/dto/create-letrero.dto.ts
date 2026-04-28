import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsIn, IsInt, Min } from 'class-validator';

/**
 * DTO para crear un nuevo letrero
 */
export class CreateLetreroDto {
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
  @IsIn(['RPI', 'PLC_S', 'PLC_N', 'DWORD'], { message: 'El tipo de dispositivo debe ser RPI, PLC_S, PLC_N o DWORD' })
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD';

  @IsOptional()
  @IsString()
  @IsIn(['24V', '48V'], { message: 'El tipo de batería debe ser 24V o 48V' })
  tipoBateria?: '24V' | '48V';

  @IsOptional()
  @IsString()
  @IsIn(['chancado', 'luminarias', 'barreras', 'letreros', 'otras_barreras', 'otros', 'prueba', 'sin_asignar'])
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar';

  @IsOptional()
  @IsString({ message: 'La URL de cámara debe ser una cadena de texto' })
  @MaxLength(1000, { message: 'La URL de cámara no puede exceder 1000 caracteres' })
  urlCamara?: string;

  @IsOptional()
  @IsString({ message: 'El comando de encendido debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El comando de encendido no puede exceder 255 caracteres' })
  comandoEncender?: string;

  @IsOptional()
  @IsString({ message: 'La plantilla de duración debe ser una cadena de texto' })
  @MaxLength(255, { message: 'La plantilla de duración no puede exceder 255 caracteres' })
  comandoDuracionTemplate?: string;

  @IsOptional()
  @IsInt({ message: 'La duración por defecto debe ser un número entero' })
  @Min(1, { message: 'La duración por defecto debe ser mayor o igual a 1 segundo' })
  duracionDefaultSegundos?: number;
}
