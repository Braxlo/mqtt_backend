import { IsString, IsNotEmpty, MaxLength, MinLength, Matches } from 'class-validator';

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
}

