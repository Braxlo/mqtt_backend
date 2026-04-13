import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsIn, IsInt, Min, IsBoolean, Matches, IsDateString } from 'class-validator';

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
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0, { message: 'El orden no puede ser negativo' })
  orden?: number;

  @IsOptional()
  @IsString({ message: 'La cabecera de control debe ser una cadena de texto' })
  @MinLength(1, { message: 'La cabecera de control no puede estar vacía' })
  @MaxLength(10, { message: 'La cabecera de control no puede exceder 10 caracteres' })
  controlHeader?: string;

  @IsOptional()
  @IsBoolean({ message: 'La visibilidad de la tarjeta de control debe ser verdadero o falso' })
  mostrarTarjetaControl?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'controlHoraInicio debe ser HH:MM (24h)' })
  controlHoraInicio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'controlHoraFin debe ser HH:MM (24h)' })
  controlHoraFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  controlUltimaTrama?: string;

  @IsOptional()
  @IsDateString()
  controlUltimaEnviadaAt?: string;
}

