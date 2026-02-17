import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Letrero as LetreroEntity } from '../entities/letrero.entity';
import { ConfiguracionLetrero } from './interfaces/letrero.interface';
import { CreateLetreroDto } from './dto/create-letrero.dto';
import { UpdateLetreroDto } from './dto/update-letrero.dto';

/**
 * Servicio para gestionar letreros
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class LetrerosService {
  private readonly logger = new Logger(LetrerosService.name);

  constructor(
    @InjectRepository(LetreroEntity)
    private letreroRepository: Repository<LetreroEntity>,
  ) {}

  /**
   * Obtener todos los letreros
   */
  async findAll(): Promise<ConfiguracionLetrero[]> {
    const letreros = await this.letreroRepository.find({
      order: { createdAt: 'DESC' },
    });
    return letreros.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      topic: l.topic,
      tipoDispositivo: l.tipoDispositivo || 'PLC_S',
    }));
  }

  /**
   * Obtener un letrero por ID
   */
  async findOne(id: string): Promise<ConfiguracionLetrero> {
    const letrero = await this.letreroRepository.findOne({ where: { id } });
    if (!letrero) {
      throw new NotFoundException(`Letrero con ID ${id} no encontrado`);
    }
    return {
      id: letrero.id,
      nombre: letrero.nombre,
      topic: letrero.topic,
      tipoDispositivo: letrero.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Crear un nuevo letrero
   */
  async create(createLetreroDto: CreateLetreroDto): Promise<ConfiguracionLetrero> {
    const nuevoLetrero = this.letreroRepository.create({
      id: Date.now().toString(),
      tipoDispositivo: createLetreroDto.tipoDispositivo || 'PLC_S',
      ...createLetreroDto,
    });
    const savedLetrero = await this.letreroRepository.save(nuevoLetrero);
    this.logger.log(`Letrero creado: ${savedLetrero.nombre} (ID: ${savedLetrero.id}, Tipo: ${savedLetrero.tipoDispositivo})`);
    return {
      id: savedLetrero.id,
      nombre: savedLetrero.nombre,
      topic: savedLetrero.topic,
      tipoDispositivo: savedLetrero.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Actualizar un letrero existente
   */
  async update(id: string, updateLetreroDto: UpdateLetreroDto): Promise<ConfiguracionLetrero> {
    const letrero = await this.letreroRepository.findOne({ where: { id } });
    if (!letrero) {
      throw new NotFoundException(`Letrero con ID ${id} no encontrado`);
    }

    Object.assign(letrero, updateLetreroDto);
    // Si no se proporciona tipoDispositivo en la actualización, mantener el existente
    if (updateLetreroDto.tipoDispositivo === undefined) {
      letrero.tipoDispositivo = letrero.tipoDispositivo || 'PLC_S';
    }
    const updatedLetrero = await this.letreroRepository.save(letrero);
    this.logger.log(`Letrero actualizado: ${updatedLetrero.nombre} (ID: ${id}, Tipo: ${updatedLetrero.tipoDispositivo})`);
    return {
      id: updatedLetrero.id,
      nombre: updatedLetrero.nombre,
      topic: updatedLetrero.topic,
      tipoDispositivo: updatedLetrero.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Eliminar un letrero
   */
  async remove(id: string): Promise<void> {
    const letrero = await this.letreroRepository.findOne({ where: { id } });
    if (!letrero) {
      throw new NotFoundException(`Letrero con ID ${id} no encontrado`);
    }
    const nombre = letrero.nombre;
    await this.letreroRepository.remove(letrero);
    this.logger.log(`Letrero eliminado: ${nombre} (ID: ${id})`);
  }
}
