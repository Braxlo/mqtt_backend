import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PuntoReferencia as PuntoReferenciaEntity } from '../entities/punto-referencia.entity';
import { ConfiguracionPuntoReferencia } from './interfaces/punto-referencia.interface';
import { CreatePuntoReferenciaDto } from './dto/create-punto-referencia.dto';
import { UpdatePuntoReferenciaDto } from './dto/update-punto-referencia.dto';

/**
 * Servicio para gestionar puntos de referencia HKN
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class PuntosReferenciaService {
  private readonly logger = new Logger(PuntosReferenciaService.name);

  constructor(
    @InjectRepository(PuntoReferenciaEntity)
    private puntoReferenciaRepository: Repository<PuntoReferenciaEntity>,
  ) {}

  /**
   * Obtener todos los puntos de referencia
   */
  async findAll(): Promise<ConfiguracionPuntoReferencia[]> {
    const puntos = await this.puntoReferenciaRepository.find({
      order: { codigo: 'ASC' },
    });
    return puntos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      latitud: Number(p.latitud),
      longitud: Number(p.longitud),
      descripcion: p.descripcion,
      tipo: p.tipo,
    }));
  }

  /**
   * Obtener un punto de referencia por ID
   */
  async findOne(id: number): Promise<ConfiguracionPuntoReferencia> {
    const punto = await this.puntoReferenciaRepository.findOne({ where: { id } });
    if (!punto) {
      throw new NotFoundException(`Punto de referencia con ID ${id} no encontrado`);
    }
    return {
      id: punto.id,
      nombre: punto.nombre,
      codigo: punto.codigo,
      latitud: Number(punto.latitud),
      longitud: Number(punto.longitud),
      descripcion: punto.descripcion,
      tipo: punto.tipo,
    };
  }

  /**
   * Crear un nuevo punto de referencia
   */
  async create(createDto: CreatePuntoReferenciaDto): Promise<ConfiguracionPuntoReferencia> {
    const nuevoPunto = this.puntoReferenciaRepository.create({
      ...createDto,
    });
    const savedPunto = await this.puntoReferenciaRepository.save(nuevoPunto);
    this.logger.log(`Punto de referencia creado: ${savedPunto.nombre} (${savedPunto.codigo})`);
    return {
      id: savedPunto.id,
      nombre: savedPunto.nombre,
      codigo: savedPunto.codigo,
      latitud: Number(savedPunto.latitud),
      longitud: Number(savedPunto.longitud),
      descripcion: savedPunto.descripcion,
      tipo: savedPunto.tipo,
    };
  }

  /**
   * Actualizar un punto de referencia existente
   */
  async update(id: number, updateDto: UpdatePuntoReferenciaDto): Promise<ConfiguracionPuntoReferencia> {
    const punto = await this.puntoReferenciaRepository.findOne({ where: { id } });
    if (!punto) {
      throw new NotFoundException(`Punto de referencia con ID ${id} no encontrado`);
    }

    Object.assign(punto, updateDto);
    const updatedPunto = await this.puntoReferenciaRepository.save(punto);
    this.logger.log(`Punto de referencia actualizado: ${updatedPunto.nombre} (${updatedPunto.codigo})`);
    return {
      id: updatedPunto.id,
      nombre: updatedPunto.nombre,
      codigo: updatedPunto.codigo,
      latitud: Number(updatedPunto.latitud),
      longitud: Number(updatedPunto.longitud),
      descripcion: updatedPunto.descripcion,
      tipo: updatedPunto.tipo,
    };
  }

  /**
   * Eliminar un punto de referencia
   */
  async remove(id: number): Promise<void> {
    const punto = await this.puntoReferenciaRepository.findOne({ where: { id } });
    if (!punto) {
      throw new NotFoundException(`Punto de referencia con ID ${id} no encontrado`);
    }
    const nombre = punto.nombre;
    await this.puntoReferenciaRepository.remove(punto);
    this.logger.log(`Punto de referencia eliminado: ${nombre} (ID: ${id})`);
  }
}
