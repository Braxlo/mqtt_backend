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

      const controlHeaderColumn = await this.luminariaRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'luminarias'
          AND column_name = 'controlHeader'
      `);
      if (controlHeaderColumn.length === 0) {
        this.logger.log('Columna controlHeader no existe en luminarias. Creando columna...');
        await this.luminariaRepository.query(`
          ALTER TABLE luminarias
          ADD COLUMN "controlHeader" VARCHAR(10) DEFAULT 'HRTW'
        `);
      }

      const mostrarTarjetaColumn = await this.luminariaRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'luminarias'
          AND column_name = 'mostrarTarjetaControl'
      `);
      if (mostrarTarjetaColumn.length === 0) {
        this.logger.log('Columna mostrarTarjetaControl no existe en luminarias. Creando columna...');
        await this.luminariaRepository.query(`
          ALTER TABLE luminarias
          ADD COLUMN "mostrarTarjetaControl" BOOLEAN DEFAULT FALSE
        `);
      }

      const extraProgramColumns: { name: string; ddl: string }[] = [
        {
          name: 'controlHoraInicio',
          ddl: `ALTER TABLE luminarias ADD COLUMN "controlHoraInicio" VARCHAR(5) NULL`,
        },
        {
          name: 'controlHoraFin',
          ddl: `ALTER TABLE luminarias ADD COLUMN "controlHoraFin" VARCHAR(5) NULL`,
        },
        {
          name: 'controlUltimaTrama',
          ddl: `ALTER TABLE luminarias ADD COLUMN "controlUltimaTrama" VARCHAR(32) NULL`,
        },
        {
          name: 'controlUltimaEnviadaAt',
          ddl: `ALTER TABLE luminarias ADD COLUMN "controlUltimaEnviadaAt" TIMESTAMPTZ NULL`,
        },
      ];
      for (const col of extraProgramColumns) {
        const colCheck = await this.luminariaRepository.query(
          `
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'luminarias'
            AND column_name = $1
        `,
          [col.name],
        );
        if (colCheck.length === 0) {
          this.logger.log(`Columna ${col.name} no existe en luminarias. Creando columna...`);
          await this.luminariaRepository.query(col.ddl);
        }
      }
    } catch (error) {
      this.logger.error(`Error asegurando columnas de luminarias: ${error.message}`);
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
      controlHeader: l.controlHeader || 'HRTW',
      mostrarTarjetaControl: l.mostrarTarjetaControl ?? false,
      controlHoraInicio: l.controlHoraInicio ?? null,
      controlHoraFin: l.controlHoraFin ?? null,
      controlUltimaTrama: l.controlUltimaTrama ?? null,
      controlUltimaEnviadaAt: l.controlUltimaEnviadaAt
        ? (l.controlUltimaEnviadaAt instanceof Date
            ? l.controlUltimaEnviadaAt.toISOString()
            : String(l.controlUltimaEnviadaAt))
        : null,
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
      controlHeader: luminaria.controlHeader || 'HRTW',
      mostrarTarjetaControl: luminaria.mostrarTarjetaControl ?? false,
      controlHoraInicio: luminaria.controlHoraInicio ?? null,
      controlHoraFin: luminaria.controlHoraFin ?? null,
      controlUltimaTrama: luminaria.controlUltimaTrama ?? null,
      controlUltimaEnviadaAt: luminaria.controlUltimaEnviadaAt
        ? (luminaria.controlUltimaEnviadaAt instanceof Date
            ? luminaria.controlUltimaEnviadaAt.toISOString()
            : String(luminaria.controlUltimaEnviadaAt))
        : null,
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
      controlHeader: createLuminariaDto.controlHeader || 'HRTW',
      mostrarTarjetaControl: createLuminariaDto.mostrarTarjetaControl ?? false,
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
      controlHeader: savedLuminaria.controlHeader || 'HRTW',
      mostrarTarjetaControl: savedLuminaria.mostrarTarjetaControl ?? false,
      controlHoraInicio: savedLuminaria.controlHoraInicio ?? null,
      controlHoraFin: savedLuminaria.controlHoraFin ?? null,
      controlUltimaTrama: savedLuminaria.controlUltimaTrama ?? null,
      controlUltimaEnviadaAt: savedLuminaria.controlUltimaEnviadaAt
        ? (savedLuminaria.controlUltimaEnviadaAt instanceof Date
            ? savedLuminaria.controlUltimaEnviadaAt.toISOString()
            : String(savedLuminaria.controlUltimaEnviadaAt))
        : null,
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
      controlHeader: updatedLuminaria.controlHeader || 'HRTW',
      mostrarTarjetaControl: updatedLuminaria.mostrarTarjetaControl ?? false,
      controlHoraInicio: updatedLuminaria.controlHoraInicio ?? null,
      controlHoraFin: updatedLuminaria.controlHoraFin ?? null,
      controlUltimaTrama: updatedLuminaria.controlUltimaTrama ?? null,
      controlUltimaEnviadaAt: updatedLuminaria.controlUltimaEnviadaAt
        ? (updatedLuminaria.controlUltimaEnviadaAt instanceof Date
            ? updatedLuminaria.controlUltimaEnviadaAt.toISOString()
            : String(updatedLuminaria.controlUltimaEnviadaAt))
        : null,
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

