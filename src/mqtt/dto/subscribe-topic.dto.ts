import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional, IsIn } from 'class-validator';

/**
 * DTO para suscribirse a un topic MQTT
 */
export class SubscribeTopicDto {
  @IsString({ message: 'El topic debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El topic es requerido' })
  @MinLength(1, { message: 'El topic no puede estar vacío' })
  @MaxLength(255, { message: 'El topic no puede exceder 255 caracteres' })
  @Matches(/^[^#+]+$/, {
    message: 'El topic no puede contener caracteres wildcard (# o +)',
  })
  topic: string;

  @IsOptional()
  @IsString({ message: 'La categoría debe ser una cadena de texto' })
  @IsIn(['chancado', 'luminarias', 'barreras', 'otras_barreras', 'otros', 'prueba'], {
    message: 'La categoría debe ser una de: chancado, luminarias, barreras, otras_barreras, otros, prueba',
  })
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'otras_barreras' | 'otros' | 'prueba';
}

