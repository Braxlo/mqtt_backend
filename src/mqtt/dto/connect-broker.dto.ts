import { IsString, IsNotEmpty, Matches, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO para conectar a un broker MQTT
 */
export class ConnectBrokerDto {
  @IsString({ message: 'La URL del broker debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La URL del broker es requerida' })
  @Matches(/^mqtt:\/\/.+/, {
    message: 'La URL debe comenzar con mqtt://',
  })
  brokerUrl: string;

  @IsOptional()
  @IsBoolean({ message: 'autoConnect debe ser un valor booleano' })
  autoConnect?: boolean;

  @IsOptional()
  @IsString({ message: 'El username debe ser una cadena de texto' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'El password debe ser una cadena de texto' })
  password?: string;
}

