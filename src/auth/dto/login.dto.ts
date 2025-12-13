import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * DTO para el login de usuarios
 * Permite iniciar sesión con username o email
 */
export class LoginDto {
  @IsString({ message: 'El usuario o email debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El usuario o email es requerido' })
  @MinLength(3, { message: 'El usuario o email debe tener al menos 3 caracteres' })
  @MaxLength(255, { message: 'El usuario o email no puede exceder 255 caracteres' })
  usernameOrEmail: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
