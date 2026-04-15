import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
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
export class BarrerasService implements OnModuleInit {
  private readonly logger = new Logger(BarrerasService.name);

  constructor(
    @InjectRepository(BarreraEntity)
    private barreraRepository: Repository<BarreraEntity>,
  ) {}

  /**
   * Asegura que la columna tipoDispositivo exista en la tabla barreras.
   * Esto permite que el backend "migre" automáticamente sin que tengas que ejecutar el SQL manualmente.
   */
  async onModuleInit() {
    try {
      const result = await this.barreraRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'barreras'
          AND column_name = 'tipoDispositivo'
      `);

      if (result.length === 0) {
        this.logger.log('Columna tipoDispositivo no existe en barreras. Creando columna...');
        await this.barreraRepository.query(`
          ALTER TABLE barreras
          ADD COLUMN "tipoDispositivo" VARCHAR(10) DEFAULT 'PLC_S'
        `);
        await this.barreraRepository.query(`
          UPDATE barreras
          SET "tipoDispositivo" = 'PLC_S'
          WHERE "tipoDispositivo" IS NULL
        `);
        this.logger.log('Columna tipoDispositivo creada e inicializada en barreras.');
      } else {
        this.logger.debug('Columna tipoDispositivo ya existe en barreras.');
      }

      const enclavar = await this.barreraRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'barreras'
          AND column_name = 'comando_enclavar_arriba'
      `);
      if (enclavar.length === 0) {
        this.logger.log('Columna comando_enclavar_arriba no existe en barreras. Creando columna...');
        await this.barreraRepository.query(`
          ALTER TABLE barreras
          ADD COLUMN comando_enclavar_arriba TEXT NULL
        `);
        this.logger.log('Columna comando_enclavar_arriba creada en barreras.');
      }

      const enclavarOff = await this.barreraRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'barreras'
          AND column_name = 'comando_enclavar_arriba_off'
      `);
      if (enclavarOff.length === 0) {
        this.logger.log('Columna comando_enclavar_arriba_off no existe en barreras. Creando columna...');
        await this.barreraRepository.query(`
          ALTER TABLE barreras
          ADD COLUMN comando_enclavar_arriba_off TEXT NULL
        `);
        this.logger.log('Columna comando_enclavar_arriba_off creada en barreras.');
      }
    } catch (error) {
      this.logger.error(`Error asegurando columna tipoDispositivo en barreras: ${error.message}`);
    }
  }

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
      comandoEnclavarArriba: b.comandoEnclavarArriba,
      comandoEnclavarArribaOff: b.comandoEnclavarArribaOff,
      comandoEstado: b.comandoEstado,
      funcion: b.funcion,
      orden: b.orden,
      tipoBateria: b.tipoBateria || '48V',
      tipoDispositivo: b.tipoDispositivo || 'PLC_S',
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
      comandoEnclavarArriba: barrera.comandoEnclavarArriba,
      comandoEnclavarArribaOff: barrera.comandoEnclavarArribaOff,
      comandoEstado: barrera.comandoEstado,
      funcion: barrera.funcion,
      orden: barrera.orden,
      tipoBateria: barrera.tipoBateria || '48V',
      tipoDispositivo: barrera.tipoDispositivo || 'PLC_S',
      categoria: barrera.categoria ?? 'sin_asignar',
    };
  }

  /**
   * Crear una nueva barrera
   */
  async create(createBarreraDto: CreateBarreraDto): Promise<ConfiguracionBarrera> {
    const nuevaBarrera = this.barreraRepository.create({
      id: Date.now().toString(),
      tipoBateria: createBarreraDto.tipoBateria || '48V',
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
      comandoEnclavarArriba: savedBarrera.comandoEnclavarArriba,
      comandoEnclavarArribaOff: savedBarrera.comandoEnclavarArribaOff,
      comandoEstado: savedBarrera.comandoEstado,
      funcion: savedBarrera.funcion,
      orden: savedBarrera.orden,
      tipoBateria: savedBarrera.tipoBateria || '48V',
      tipoDispositivo: savedBarrera.tipoDispositivo || 'PLC_S',
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
      comandoEnclavarArriba: updatedBarrera.comandoEnclavarArriba,
      comandoEnclavarArribaOff: updatedBarrera.comandoEnclavarArribaOff,
      comandoEstado: updatedBarrera.comandoEstado,
      funcion: updatedBarrera.funcion,
      orden: updatedBarrera.orden,
      tipoBateria: updatedBarrera.tipoBateria || '48V',
      tipoDispositivo: updatedBarrera.tipoDispositivo || 'PLC_S',
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

