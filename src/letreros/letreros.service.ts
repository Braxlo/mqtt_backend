import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
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
export class LetrerosService implements OnModuleInit {
  private readonly logger = new Logger(LetrerosService.name);

  constructor(
    @InjectRepository(LetreroEntity)
    private letreroRepository: Repository<LetreroEntity>,
  ) {}

  /**
   * Asegura que la columna orden exista en la tabla letreros.
   * Sigue el mismo patrón que luminarias.
   */
  async onModuleInit() {
    try {
      const result = await this.letreroRepository.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'letreros'
          AND column_name = 'orden'
      `);

      if (result.length === 0) {
        this.logger.log('Columna orden no existe en letreros. Creando columna...');
        await this.letreroRepository.query(`
          ALTER TABLE letreros
          ADD COLUMN orden INTEGER DEFAULT 0
        `);
        await this.letreroRepository.query(`
          UPDATE letreros
          SET orden = 0
          WHERE orden IS NULL
        `);
        this.logger.log('Columna orden creada e inicializada en letreros.');
      } else {
        this.logger.debug('Columna orden ya existe en letreros.');
      }

      const extraColumns: { name: string; ddl: string }[] = [
        {
          name: 'urlCamara',
          ddl: `ALTER TABLE letreros ADD COLUMN "urlCamara" VARCHAR(1000) NULL DEFAULT ''`,
        },
        {
          name: 'comandoEncender',
          ddl: `ALTER TABLE letreros ADD COLUMN "comandoEncender" VARCHAR(255) NOT NULL DEFAULT 'ENCENDER'`,
        },
        {
          name: 'comandoDuracionTemplate',
          ddl: `ALTER TABLE letreros ADD COLUMN "comandoDuracionTemplate" VARCHAR(255) NOT NULL DEFAULT 'SEGUNDOS:{segundos}'`,
        },
        {
          name: 'duracionDefaultSegundos',
          ddl: `ALTER TABLE letreros ADD COLUMN "duracionDefaultSegundos" INTEGER NOT NULL DEFAULT 60`,
        },
      ];
      for (const col of extraColumns) {
        const colCheck = await this.letreroRepository.query(
          `
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'letreros'
            AND column_name = $1
        `,
          [col.name],
        );
        if (colCheck.length === 0) {
          this.logger.log(`Columna ${col.name} no existe en letreros. Creando columna...`);
          await this.letreroRepository.query(col.ddl);
        }
      }
    } catch (error) {
      this.logger.error(`Error asegurando columnas de letreros: ${error.message}`);
    }
  }

  /**
   * Obtener todos los letreros
   */
  async findAll(): Promise<ConfiguracionLetrero[]> {
    const letreros = await this.letreroRepository.find({
      order: { orden: 'ASC', createdAt: 'DESC' },
    });
    return letreros.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      topic: l.topic,
      orden: (l as any).orden ?? 0,
      tipoDispositivo: l.tipoDispositivo || 'PLC_S',
      tipoBateria: l.tipoBateria || '48V',
      categoria: l.categoria ?? 'sin_asignar',
      urlCamara: l.urlCamara ?? '',
      comandoEncender: l.comandoEncender || 'ENCENDER',
      comandoDuracionTemplate: l.comandoDuracionTemplate || 'SEGUNDOS:{segundos}',
      duracionDefaultSegundos: l.duracionDefaultSegundos ?? 60,
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
      tipoBateria: letrero.tipoBateria || '48V',
      categoria: letrero.categoria ?? 'sin_asignar',
      urlCamara: letrero.urlCamara ?? '',
      comandoEncender: letrero.comandoEncender || 'ENCENDER',
      comandoDuracionTemplate: letrero.comandoDuracionTemplate || 'SEGUNDOS:{segundos}',
      duracionDefaultSegundos: letrero.duracionDefaultSegundos ?? 60,
    };
  }

  /**
   * Crear un nuevo letrero
   */
  async create(createLetreroDto: CreateLetreroDto): Promise<ConfiguracionLetrero> {
    const topic = (createLetreroDto.topic || '').trim();
    const nuevoLetrero = this.letreroRepository.create({
      id: Date.now().toString(),
      topic,
      nombre: createLetreroDto.nombre,
      orden: (createLetreroDto as any).orden ?? 0,
      tipoDispositivo: createLetreroDto.tipoDispositivo || 'PLC_S',
      tipoBateria: createLetreroDto.tipoBateria || '48V',
      urlCamara: (createLetreroDto.urlCamara || '').trim(),
      comandoEncender: (createLetreroDto.comandoEncender || 'ENCENDER').trim() || 'ENCENDER',
      comandoDuracionTemplate:
        (createLetreroDto.comandoDuracionTemplate || 'SEGUNDOS:{segundos}').trim() || 'SEGUNDOS:{segundos}',
      duracionDefaultSegundos:
        Number.isFinite(createLetreroDto.duracionDefaultSegundos as number) &&
        (createLetreroDto.duracionDefaultSegundos as number) > 0
          ? Math.round(createLetreroDto.duracionDefaultSegundos as number)
          : 60,
      categoria: 'letreros', // Siempre se muestra en la página de Letreros
    });
    const savedLetrero = await this.letreroRepository.save(nuevoLetrero);
    this.logger.log(`Letrero creado: ${savedLetrero.nombre} (ID: ${savedLetrero.id}, Tipo: ${savedLetrero.tipoDispositivo})`);
    return {
      id: savedLetrero.id,
      nombre: savedLetrero.nombre,
      topic: savedLetrero.topic,
      orden: (savedLetrero as any).orden ?? 0,
      tipoDispositivo: savedLetrero.tipoDispositivo || 'PLC_S',
      tipoBateria: savedLetrero.tipoBateria || '48V',
      categoria: savedLetrero.categoria ?? 'sin_asignar',
      urlCamara: savedLetrero.urlCamara ?? '',
      comandoEncender: savedLetrero.comandoEncender || 'ENCENDER',
      comandoDuracionTemplate: savedLetrero.comandoDuracionTemplate || 'SEGUNDOS:{segundos}',
      duracionDefaultSegundos: savedLetrero.duracionDefaultSegundos ?? 60,
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
    if (updateLetreroDto.topic !== undefined) {
      letrero.topic = (updateLetreroDto.topic || '').trim();
    }
    if (updateLetreroDto.tipoDispositivo === undefined) {
      letrero.tipoDispositivo = letrero.tipoDispositivo || 'PLC_S';
    }
    if (updateLetreroDto.tipoBateria === undefined) {
      letrero.tipoBateria = letrero.tipoBateria || '48V';
    }
    if (updateLetreroDto.urlCamara !== undefined) {
      letrero.urlCamara = (updateLetreroDto.urlCamara || '').trim();
    }
    if (updateLetreroDto.comandoEncender !== undefined) {
      letrero.comandoEncender = (updateLetreroDto.comandoEncender || '').trim() || 'ENCENDER';
    }
    if (updateLetreroDto.comandoDuracionTemplate !== undefined) {
      letrero.comandoDuracionTemplate =
        (updateLetreroDto.comandoDuracionTemplate || '').trim() || 'SEGUNDOS:{segundos}';
    }
    if (updateLetreroDto.duracionDefaultSegundos !== undefined) {
      const v = Number(updateLetreroDto.duracionDefaultSegundos);
      letrero.duracionDefaultSegundos = Number.isFinite(v) && v > 0 ? Math.round(v) : 60;
    }
    if ((updateLetreroDto as any).orden === undefined || (updateLetreroDto as any).orden === null) {
      (letrero as any).orden = (letrero as any).orden ?? 0;
    }
    letrero.categoria = 'letreros'; // Siempre se muestra en la página de Letreros
    const updatedLetrero = await this.letreroRepository.save(letrero);
    this.logger.log(`Letrero actualizado: ${updatedLetrero.nombre} (ID: ${id})`);
    return {
      id: updatedLetrero.id,
      nombre: updatedLetrero.nombre,
      topic: updatedLetrero.topic,
      orden: (updatedLetrero as any).orden ?? 0,
      tipoDispositivo: updatedLetrero.tipoDispositivo || 'PLC_S',
      tipoBateria: updatedLetrero.tipoBateria || '48V',
      categoria: updatedLetrero.categoria ?? 'sin_asignar',
      urlCamara: updatedLetrero.urlCamara ?? '',
      comandoEncender: updatedLetrero.comandoEncender || 'ENCENDER',
      comandoDuracionTemplate: updatedLetrero.comandoDuracionTemplate || 'SEGUNDOS:{segundos}',
      duracionDefaultSegundos: updatedLetrero.duracionDefaultSegundos ?? 60,
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

  /**
   * Actualizar el orden de múltiples letreros
   */
  async updateOrder(letrerosOrden: { id: string; orden: number }[]): Promise<void> {
    for (const { id, orden } of letrerosOrden) {
      await this.letreroRepository.update(id, { orden });
    }
    this.logger.log(`Orden actualizado para ${letrerosOrden.length} letreros`);
  }
}
