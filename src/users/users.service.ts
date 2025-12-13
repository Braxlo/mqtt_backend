import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as UserEntity } from '../entities/user.entity';
import { User, UserResponse } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Servicio para gestionar usuarios
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Obtener todos los usuarios (sin contraseñas)
   */
  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
    return users.map((user) => {
      const { password, ...userResponse } = user;
      return userResponse;
    });
  }

  /**
   * Obtener un usuario por ID (sin contraseña)
   */
  async findOne(id: number): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    const { password, ...userResponse } = user;
    return userResponse;
  }

  /**
   * Buscar usuario por username (para autenticación)
   */
  async findByUsername(username: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) return null;
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      username: user.username,
      password: user.password,
      rol: user.rol,
    };
  }

  /**
   * Buscar usuario por email (para autenticación)
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return null;
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      username: user.username,
      password: user.password,
      rol: user.rol,
    };
  }

  /**
   * Buscar usuario por username o email (para autenticación)
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
      ],
    });
    if (!user) return null;
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      username: user.username,
      password: user.password,
      rol: user.rol,
    };
  }

  /**
   * Verificar si un username o email ya existe
   */
  private async exists(
    username: string,
    email: string,
    excludeId?: number,
  ): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: [
        { username },
        { email },
      ],
    });
    return user !== null && (!excludeId || user.id !== excludeId);
  }

  /**
   * Crear un nuevo usuario
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    if (await this.exists(createUserDto.username, createUserDto.email)) {
      throw new ConflictException(
        'Ya existe un usuario con ese nombre de usuario o email',
      );
    }

    const nuevoUsuario = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(nuevoUsuario);
    this.logger.log(`Usuario creado: ${savedUser.nombre} (ID: ${savedUser.id})`);

    const { password, ...userResponse } = savedUser;
    return userResponse;
  }

  /**
   * Actualizar un usuario existente
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    // Verificar si el nuevo username o email ya existe en otro usuario
    if (
      (updateUserDto.username || updateUserDto.email) &&
      (await this.exists(
        updateUserDto.username || user.username,
        updateUserDto.email || user.email,
        id,
      ))
    ) {
      throw new ConflictException(
        'Ya existe un usuario con ese nombre de usuario o email',
      );
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`Usuario actualizado: ${updatedUser.nombre} (ID: ${id})`);

    const { password, ...userResponse } = updatedUser;
    return userResponse;
  }

  /**
   * Eliminar un usuario
   */
  async remove(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    const nombre = user.nombre;
    await this.userRepository.remove(user);
    this.logger.log(`Usuario eliminado: ${nombre} (ID: ${id})`);
  }
}

