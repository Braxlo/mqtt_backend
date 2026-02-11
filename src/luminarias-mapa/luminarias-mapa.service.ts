import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LuminariaMapa } from '../entities/luminaria-mapa.entity';
import { CreateLuminariaMapaDto } from './dto/create-luminaria-mapa.dto';
import { UpdateLuminariaMapaDto } from './dto/update-luminaria-mapa.dto';

/**
 * Servicio para gestionar posiciones de luminarias en el mapa
 */
@Injectable()
export class LuminariasMapaService {
  private readonly logger = new Logger(LuminariasMapaService.name);

  constructor(
    @InjectRepository(LuminariaMapa)
    private luminariaMapaRepository: Repository<LuminariaMapa>,
  ) {}

  /**
   * Obtener todas las posiciones de luminarias
   */
  async findAll(): Promise<LuminariaMapa[]> {
    return this.luminariaMapaRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtener una posición por ID
   */
  async findOne(id: number): Promise<LuminariaMapa> {
    const luminaria = await this.luminariaMapaRepository.findOne({ where: { id } });
    if (!luminaria) {
      throw new NotFoundException(`Posición de luminaria con ID ${id} no encontrada`);
    }
    return luminaria;
  }

  /**
   * Buscar posición por luminariaId
   */
  async findByLuminariaId(luminariaId: string): Promise<LuminariaMapa | null> {
    return this.luminariaMapaRepository.findOne({
      where: { luminariaId },
    });
  }

  /**
   * Crear o actualizar posición de luminaria
   * Si ya existe una posición para esta luminariaId, la actualiza
   */
  async createOrUpdate(createDto: CreateLuminariaMapaDto): Promise<LuminariaMapa> {
    const existente = await this.findByLuminariaId(createDto.luminariaId);
    
    if (existente) {
      // Actualizar existente
      Object.assign(existente, createDto);
      const actualizada = await this.luminariaMapaRepository.save(existente);
      this.logger.log(`Posición actualizada para luminaria ${createDto.luminariaId}`);
      return actualizada;
    } else {
      // Crear nueva
      const nueva = this.luminariaMapaRepository.create(createDto);
      const creada = await this.luminariaMapaRepository.save(nueva);
      this.logger.log(`Nueva posición creada para luminaria ${createDto.luminariaId}`);
      return creada;
    }
  }

  /**
   * Crear nueva posición
   */
  async create(createDto: CreateLuminariaMapaDto): Promise<LuminariaMapa> {
    const nueva = this.luminariaMapaRepository.create(createDto);
    const creada = await this.luminariaMapaRepository.save(nueva);
    this.logger.log(`Posición creada para luminaria ${createDto.luminariaId}`);
    return creada;
  }

  /**
   * Actualizar posición existente
   */
  async update(id: number, updateDto: UpdateLuminariaMapaDto): Promise<LuminariaMapa> {
    const luminaria = await this.findOne(id);
    Object.assign(luminaria, updateDto);
    const actualizada = await this.luminariaMapaRepository.save(luminaria);
    this.logger.log(`Posición actualizada (ID: ${id})`);
    return actualizada;
  }

  /**
   * Eliminar posición
   */
  async remove(id: number): Promise<void> {
    const luminaria = await this.findOne(id);
    await this.luminariaMapaRepository.remove(luminaria);
    this.logger.log(`Posición eliminada (ID: ${id})`);
  }

  /**
   * Eliminar posición por luminariaId
   */
  async removeByLuminariaId(luminariaId: string): Promise<boolean> {
    const luminaria = await this.findByLuminariaId(luminariaId);
    if (!luminaria) return false;
    await this.luminariaMapaRepository.remove(luminaria);
    this.logger.log(`Posición eliminada para luminaria ${luminariaId}`);
    return true;
  }
}
