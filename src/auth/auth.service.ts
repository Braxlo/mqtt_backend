import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/interfaces/user.interface';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  /**
   * Valida las credenciales de un usuario
   * Permite buscar por username o email
   */
  async validateUser(usernameOrEmail: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsernameOrEmail(usernameOrEmail);
    
    if (!user || user.password !== password) {
      return null;
    }
    
    // Mapear rol del sistema de usuarios al formato esperado
    const role = user.rol === 'Administrador' ? 'admin' : 'operador';
    
    return {
      id: user.id,
      username: user.username,
      role,
    };
  }

  /**
   * Autentica un usuario y genera un token JWT
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.usernameOrEmail, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN,
    });

    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
