import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
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
export class LuminariasService implements OnModuleInit {
  private readonly logger = new Logger(LuminariasService.name);

  constructor(
    @InjectRepository(LuminariaEntity)
    private luminariaRepository: Repository<LuminariaEntity>,
  ) {}

  /**
   * Asegura que la columna orden exista en la tabla luminarias.
   * Permite migrar automáticamente sin ejecutar SQL manual.
   */
  async onModuleInit() {
    try {
      const result = await this.luminariaRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'luminarias'
          AND column_name = 'orden'
      `);

      if (result.length === 0) {
        this.logger.log('Columna orden no existe en luminarias. Creando columna...');
        await this.luminariaRepository.query(`
          ALTER TABLE luminarias
          ADD COLUMN orden INTEGER DEFAULT 0
        `);
        await this.luminariaRepository.query(`
          UPDATE luminarias
          SET orden = 0
          WHERE orden IS NULL
        `);
        this.logger.log('Columna orden creada e inicializada en luminarias.');
      } else {
        this.logger.debug('Columna orden ya existe en luminarias.');
      }
    } catch (error) {
      this.logger.error(`Error asegurando columna orden en luminarias: ${error.message}`);
    }
  }

  /**
   * Obtener todas las luminarias
   */
  async findAll(): Promise<ConfiguracionLuminaria[]> {
    const luminarias = await this.luminariaRepository.find({
      order: { orden: 'ASC', createdAt: 'DESC' },
    });
    return luminarias.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      topic: l.topic,
      orden: l.orden,
      tipoDispositivo: l.tipoDispositivo || 'PLC_S',
      tipoBateria: l.tipoBateria || '48V',
      categoria: l.categoria ?? 'sin_asignar',
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
      tipoBateria: luminaria.tipoBateria || '48V',
      categoria: luminaria.categoria ?? 'sin_asignar',
    };
  }

  /**
   * Crear una nueva luminaria
   */
  async create(createLuminariaDto: CreateLuminariaDto): Promise<ConfiguracionLuminaria> {
    const nuevaLuminaria = this.luminariaRepository.create({
      id: Date.now().toString(),
      tipoDispositivo: createLuminariaDto.tipoDispositivo || 'PLC_S',
      tipoBateria: createLuminariaDto.tipoBateria || '48V',
      orden: createLuminariaDto.orden ?? 0,
      ...createLuminariaDto,
      categoria: 'luminarias', // Siempre se muestra en la página de Luminarias
    });
    const savedLuminaria = await this.luminariaRepository.save(nuevaLuminaria);
    this.logger.log(`Luminaria creada: ${savedLuminaria.nombre} (ID: ${savedLuminaria.id}, Tipo: ${savedLuminaria.tipoDispositivo})`);
    return {
      id: savedLuminaria.id,
      nombre: savedLuminaria.nombre,
      topic: savedLuminaria.topic,
      orden: savedLuminaria.orden,
      tipoDispositivo: savedLuminaria.tipoDispositivo || 'PLC_S',
      tipoBateria: savedLuminaria.tipoBateria || '48V',
      categoria: savedLuminaria.categoria ?? 'sin_asignar',
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
    if (updateLuminariaDto.tipoDispositivo === undefined) {
      luminaria.tipoDispositivo = luminaria.tipoDispositivo || 'PLC_S';
    }
    if (updateLuminariaDto.tipoBateria === undefined) {
      luminaria.tipoBateria = luminaria.tipoBateria || '48V';
    }
    if (updateLuminariaDto.orden === undefined || updateLuminariaDto.orden === null) {
      luminaria.orden = luminaria.orden ?? 0;
    }
    luminaria.categoria = 'luminarias'; // Siempre se muestra en la página de Luminarias
    const updatedLuminaria = await this.luminariaRepository.save(luminaria);
    this.logger.log(`Luminaria actualizada: ${updatedLuminaria.nombre} (ID: ${id})`);
    return {
      id: updatedLuminaria.id,
      nombre: updatedLuminaria.nombre,
      topic: updatedLuminaria.topic,
      orden: updatedLuminaria.orden,
      tipoDispositivo: updatedLuminaria.tipoDispositivo || 'PLC_S',
      tipoBateria: updatedLuminaria.tipoBateria || '48V',
      categoria: updatedLuminaria.categoria ?? 'sin_asignar',
    };
  }

  /**
   * Actualizar el orden de múltiples luminarias
   */
  async updateOrder(luminariasOrden: { id: string; orden: number }[]): Promise<void> {
    for (const { id, orden } of luminariasOrden) {
      await this.luminariaRepository.update(id, { orden });
    }
    this.logger.log(`Orden actualizado para ${luminariasOrden.length} luminarias`);
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

