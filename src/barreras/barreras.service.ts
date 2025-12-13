import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barrera as BarreraEntity } from '../entities/barrera.entity';
import { ConfiguracionBarrera } from './interfaces/barrera.interface';
import { CreateBarreraDto } from './dto/create-barrera.dto';
import { UpdateBarreraDto } from './dto/update-barrera.dto';

/**
 * Servicio para gestionar barreras
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class BarrerasService {
  private readonly logger = new Logger(BarrerasService.name);

  constructor(
    @InjectRepository(BarreraEntity)
    private barreraRepository: Repository<BarreraEntity>,
  ) {}

  /**
   * Obtener todas las barreras
   */
  async findAll(): Promise<ConfiguracionBarrera[]> {
    const barreras = await this.barreraRepository.find({
      order: { createdAt: 'DESC' },
    });
    return barreras.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      topic: b.topic,
      urlCamara: b.urlCamara,
      comandoAbrir: b.comandoAbrir,
      comandoCerrar: b.comandoCerrar,
    }));
  }

  /**
   * Obtener una barrera por ID
   */
  async findOne(id: string): Promise<ConfiguracionBarrera> {
    const barrera = await this.barreraRepository.findOne({ where: { id } });
    if (!barrera) {
      throw new NotFoundException(`Barrera con ID ${id} no encontrada`);
    }
    return {
      id: barrera.id,
      nombre: barrera.nombre,
      topic: barrera.topic,
      urlCamara: barrera.urlCamara,
      comandoAbrir: barrera.comandoAbrir,
      comandoCerrar: barrera.comandoCerrar,
    };
  }

  /**
   * Crear una nueva barrera
   */
  async create(createBarreraDto: CreateBarreraDto): Promise<ConfiguracionBarrera> {
    const nuevaBarrera = this.barreraRepository.create({
      id: Date.now().toString(),
      ...createBarreraDto,
      urlCamara: createBarreraDto.urlCamara || '',
    });
    const savedBarrera = await this.barreraRepository.save(nuevaBarrera);
    this.logger.log(`Barrera creada: ${savedBarrera.nombre} (ID: ${savedBarrera.id})`);
    return {
      id: savedBarrera.id,
      nombre: savedBarrera.nombre,
      topic: savedBarrera.topic,
      urlCamara: savedBarrera.urlCamara,
      comandoAbrir: savedBarrera.comandoAbrir,
      comandoCerrar: savedBarrera.comandoCerrar,
    };
  }

  /**
   * Actualizar una barrera existente
   */
  async update(id: string, updateBarreraDto: UpdateBarreraDto): Promise<ConfiguracionBarrera> {
    const barrera = await this.barreraRepository.findOne({ where: { id } });
    if (!barrera) {
      throw new NotFoundException(`Barrera con ID ${id} no encontrada`);
    }

    Object.assign(barrera, updateBarreraDto);
    const updatedBarrera = await this.barreraRepository.save(barrera);
    this.logger.log(`Barrera actualizada: ${updatedBarrera.nombre} (ID: ${id})`);
    return {
      id: updatedBarrera.id,
      nombre: updatedBarrera.nombre,
      topic: updatedBarrera.topic,
      urlCamara: updatedBarrera.urlCamara,
      comandoAbrir: updatedBarrera.comandoAbrir,
      comandoCerrar: updatedBarrera.comandoCerrar,
    };
  }

  /**
   * Eliminar una barrera
   */
  async remove(id: string): Promise<void> {
    const barrera = await this.barreraRepository.findOne({ where: { id } });
    if (!barrera) {
      throw new NotFoundException(`Barrera con ID ${id} no encontrada`);
    }
    const nombre = barrera.nombre;
    await this.barreraRepository.remove(barrera);
    this.logger.log(`Barrera eliminada: ${nombre} (ID: ${id})`);
  }
}

