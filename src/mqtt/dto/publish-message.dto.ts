import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

/**
 * DTO para publicar un mensaje MQTT
 */
export class PublishMessageDto {
  @IsString({ message: 'El topic debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El topic es requerido' })
  @MinLength(1, { message: 'El topic no puede estar vacío' })
  @MaxLength(255, { message: 'El topic no puede exceder 255 caracteres' })
  topic: string;

  @IsString({ message: 'El mensaje debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El mensaje es requerido' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío' })
  message: string;
}

