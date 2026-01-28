import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Luminaria as LuminariaEntity } from '../entities/luminaria.entity';
import { ConfiguracionLuminaria } from './interfaces/luminaria.interface';
import { CreateLuminariaDto } from './dto/create-luminaria.dto';
import { UpdateLuminariaDto } from './dto/update-luminaria.dto';

/**
 * Servicio para gestionar luminarias
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class LuminariasService {
  private readonly logger = new Logger(LuminariasService.name);

  constructor(
    @InjectRepository(LuminariaEntity)
    private luminariaRepository: Repository<LuminariaEntity>,
  ) {}

  /**
   * Obtener todas las luminarias
   */
  async findAll(): Promise<ConfiguracionLuminaria[]> {
    const luminarias = await this.luminariaRepository.find({
      order: { createdAt: 'DESC' },
    });
    return luminarias.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      topic: l.topic,
      tipoDispositivo: l.tipoDispositivo || 'PLC_S',
    }));
  }

  /**
   * Obtener una luminaria por ID
   */
  async findOne(id: string): Promise<ConfiguracionLuminaria> {
    const luminaria = await this.luminariaRepository.findOne({ where: { id } });
    if (!luminaria) {
      throw new NotFoundException(`Luminaria con ID ${id} no encontrada`);
    }
    return {
      id: luminaria.id,
      nombre: luminaria.nombre,
      topic: luminaria.topic,
      tipoDispositivo: luminaria.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Crear una nueva luminaria
   */
  async create(createLuminariaDto: CreateLuminariaDto): Promise<ConfiguracionLuminaria> {
    const nuevaLuminaria = this.luminariaRepository.create({
      id: Date.now().toString(),
      tipoDispositivo: createLuminariaDto.tipoDispositivo || 'PLC_S',
      ...createLuminariaDto,
    });
    const savedLuminaria = await this.luminariaRepository.save(nuevaLuminaria);
    this.logger.log(`Luminaria creada: ${savedLuminaria.nombre} (ID: ${savedLuminaria.id}, Tipo: ${savedLuminaria.tipoDispositivo})`);
    return {
      id: savedLuminaria.id,
      nombre: savedLuminaria.nombre,
      topic: savedLuminaria.topic,
      tipoDispositivo: savedLuminaria.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Actualizar una luminaria existente
   */
  async update(id: string, updateLuminariaDto: UpdateLuminariaDto): Promise<ConfiguracionLuminaria> {
    const luminaria = await this.luminariaRepository.findOne({ where: { id } });
    if (!luminaria) {
      throw new NotFoundException(`Luminaria con ID ${id} no encontrada`);
    }

    Object.assign(luminaria, updateLuminariaDto);
    // Si no se proporciona tipoDispositivo en la actualización, mantener el existente
    if (updateLuminariaDto.tipoDispositivo === undefined) {
      luminaria.tipoDispositivo = luminaria.tipoDispositivo || 'PLC_S';
    }
    const updatedLuminaria = await this.luminariaRepository.save(luminaria);
    this.logger.log(`Luminaria actualizada: ${updatedLuminaria.nombre} (ID: ${id}, Tipo: ${updatedLuminaria.tipoDispositivo})`);
    return {
      id: updatedLuminaria.id,
      nombre: updatedLuminaria.nombre,
      topic: updatedLuminaria.topic,
      tipoDispositivo: updatedLuminaria.tipoDispositivo || 'PLC_S',
    };
  }

  /**
   * Eliminar una luminaria
   */
  async remove(id: string): Promise<void> {
    const luminaria = await this.luminariaRepository.findOne({ where: { id } });
    if (!luminaria) {
      throw new NotFoundException(`Luminaria con ID ${id} no encontrada`);
    }
    const nombre = luminaria.nombre;
    await this.luminariaRepository.remove(luminaria);
    this.logger.log(`Luminaria eliminada: ${nombre} (ID: ${id})`);
  }
}

