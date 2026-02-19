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
      order: { orden: 'ASC', createdAt: 'DESC' },
    });
    return barreras.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      topic: b.topic,
      urlCamara: b.urlCamara,
      comandoAbrir: b.comandoAbrir,
      comandoCerrar: b.comandoCerrar,
      comandoEstado: b.comandoEstado,
      funcion: b.funcion,
      orden: b.orden,
      categoria: b.categoria ?? 'sin_asignar',
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
      comandoEstado: barrera.comandoEstado,
      funcion: barrera.funcion,
      orden: barrera.orden,
      categoria: barrera.categoria ?? 'sin_asignar',
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
      comandoEstado: savedBarrera.comandoEstado,
      funcion: savedBarrera.funcion,
      orden: savedBarrera.orden,
      categoria: savedBarrera.categoria ?? 'sin_asignar',
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
    // Asegurar que categoria se persista cuando viene en el DTO (evita que quede en "otros")
    if (updateBarreraDto.categoria !== undefined && updateBarreraDto.categoria !== null) {
      barrera.categoria = updateBarreraDto.categoria;
    }
    const updatedBarrera = await this.barreraRepository.save(barrera);
    this.logger.log(`Barrera actualizada: ${updatedBarrera.nombre} (ID: ${id})`);
    return {
      id: updatedBarrera.id,
      nombre: updatedBarrera.nombre,
      topic: updatedBarrera.topic,
      urlCamara: updatedBarrera.urlCamara,
      comandoAbrir: updatedBarrera.comandoAbrir,
      comandoCerrar: updatedBarrera.comandoCerrar,
      comandoEstado: updatedBarrera.comandoEstado,
      funcion: updatedBarrera.funcion,
      orden: updatedBarrera.orden,
      categoria: updatedBarrera.categoria ?? 'sin_asignar',
    };
  }

  /**
   * Actualizar el orden de múltiples barreras
   */
  async updateOrder(barrerasOrden: { id: string; orden: number }[]): Promise<void> {
    for (const { id, orden } of barrerasOrden) {
      await this.barreraRepository.update(id, { orden });
    }
    this.logger.log(`Orden actualizado para ${barrerasOrden.length} barreras`);
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

