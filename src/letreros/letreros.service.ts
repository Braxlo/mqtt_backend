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
  private static readonly MIN_SEGUNDOS = 5;
  private static readonly MAX_SEGUNDOS = 120;

  constructor(
    @InjectRepository(LetreroEntity)
    private letreroRepository: Repository<LetreroEntity>,
  ) {}

  private normalizarSegundos(value: number | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 60;
    return Math.min(LetrerosService.MAX_SEGUNDOS, Math.max(LetrerosService.MIN_SEGUNDOS, Math.round(n)));
  }

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
          ddl: `ALTER TABLE letreros ADD COLUMN "comandoEncender" VARCHAR(255) NOT NULL DEFAULT 'HRC1'`,
        },
        {
          name: 'comandoDuracionTemplate',
          ddl: `ALTER TABLE letreros ADD COLUMN "comandoDuracionTemplate" VARCHAR(255) NOT NULL DEFAULT 'HRTW'`,
        },
        {
          name: 'duracionDefaultSegundos',
          ddl: `ALTER TABLE letreros ADD COLUMN "duracionDefaultSegundos" INTEGER NOT NULL DEFAULT 60`,
        },
        {
          name: 'mostrarEnControl',
          ddl: `ALTER TABLE letreros ADD COLUMN "mostrarEnControl" BOOLEAN NOT NULL DEFAULT true`,
        },
        {
          name: 'mostrarCamara',
          ddl: `ALTER TABLE letreros ADD COLUMN "mostrarCamara" BOOLEAN NOT NULL DEFAULT true`,
        },
        {
          name: 'mostrarBotonEncender',
          ddl: `ALTER TABLE letreros ADD COLUMN "mostrarBotonEncender" BOOLEAN NOT NULL DEFAULT true`,
        },
        {
          name: 'mostrarControlSegundos',
          ddl: `ALTER TABLE letreros ADD COLUMN "mostrarControlSegundos" BOOLEAN NOT NULL DEFAULT true`,
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

      await this.letreroRepository.query(`
        UPDATE letreros
        SET "comandoEncender" = 'HRC1'
        WHERE "comandoEncender" IS NULL OR TRIM("comandoEncender") = '' OR "comandoEncender" = 'ENCENDER'
      `);
      await this.letreroRepository.query(`
        UPDATE letreros
        SET "comandoDuracionTemplate" = 'HRTW'
        WHERE "comandoDuracionTemplate" IS NULL
           OR TRIM("comandoDuracionTemplate") = ''
           OR "comandoDuracionTemplate" = 'SEGUNDOS:{segundos}'
           OR "comandoDuracionTemplate" = 'HRTW{segundos}'
      `);
      await this.letreroRepository.query(`
        UPDATE letreros
        SET "duracionDefaultSegundos" = LEAST(120, GREATEST(5, COALESCE("duracionDefaultSegundos", 60)))
      `);
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
      comandoEncender: l.comandoEncender || 'HRC1',
      comandoDuracionTemplate: l.comandoDuracionTemplate || 'HRTW',
      duracionDefaultSegundos: this.normalizarSegundos(l.duracionDefaultSegundos),
      mostrarEnControl: l.mostrarEnControl ?? true,
      mostrarCamara: l.mostrarCamara ?? true,
      mostrarBotonEncender: l.mostrarBotonEncender ?? true,
      mostrarControlSegundos: l.mostrarControlSegundos ?? true,
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
      comandoEncender: letrero.comandoEncender || 'HRC1',
      comandoDuracionTemplate: letrero.comandoDuracionTemplate || 'HRTW',
      duracionDefaultSegundos: this.normalizarSegundos(letrero.duracionDefaultSegundos),
      mostrarEnControl: letrero.mostrarEnControl ?? true,
      mostrarCamara: letrero.mostrarCamara ?? true,
      mostrarBotonEncender: letrero.mostrarBotonEncender ?? true,
      mostrarControlSegundos: letrero.mostrarControlSegundos ?? true,
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
      comandoEncender: (createLetreroDto.comandoEncender || 'HRC1').trim() || 'HRC1',
      comandoDuracionTemplate:
        (createLetreroDto.comandoDuracionTemplate || 'HRTW').trim() || 'HRTW',
      duracionDefaultSegundos: this.normalizarSegundos(createLetreroDto.duracionDefaultSegundos),
      mostrarEnControl: createLetreroDto.mostrarEnControl ?? true,
      mostrarCamara: createLetreroDto.mostrarCamara ?? true,
      mostrarBotonEncender: createLetreroDto.mostrarBotonEncender ?? true,
      mostrarControlSegundos: createLetreroDto.mostrarControlSegundos ?? true,
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
      comandoEncender: savedLetrero.comandoEncender || 'HRC1',
      comandoDuracionTemplate: savedLetrero.comandoDuracionTemplate || 'HRTW',
      duracionDefaultSegundos: this.normalizarSegundos(savedLetrero.duracionDefaultSegundos),
      mostrarEnControl: savedLetrero.mostrarEnControl ?? true,
      mostrarCamara: savedLetrero.mostrarCamara ?? true,
      mostrarBotonEncender: savedLetrero.mostrarBotonEncender ?? true,
      mostrarControlSegundos: savedLetrero.mostrarControlSegundos ?? true,
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
      letrero.comandoEncender = (updateLetreroDto.comandoEncender || '').trim() || 'HRC1';
    }
    if (updateLetreroDto.comandoDuracionTemplate !== undefined) {
      letrero.comandoDuracionTemplate =
        (updateLetreroDto.comandoDuracionTemplate || '').trim() || 'HRTW';
    }
    if (updateLetreroDto.duracionDefaultSegundos !== undefined) {
      letrero.duracionDefaultSegundos = this.normalizarSegundos(updateLetreroDto.duracionDefaultSegundos);
    }
    if (updateLetreroDto.mostrarEnControl !== undefined) {
      letrero.mostrarEnControl = updateLetreroDto.mostrarEnControl;
    }
    if (updateLetreroDto.mostrarCamara !== undefined) {
      letrero.mostrarCamara = updateLetreroDto.mostrarCamara;
    }
    if (updateLetreroDto.mostrarBotonEncender !== undefined) {
      letrero.mostrarBotonEncender = updateLetreroDto.mostrarBotonEncender;
    }
    if (updateLetreroDto.mostrarControlSegundos !== undefined) {
      letrero.mostrarControlSegundos = updateLetreroDto.mostrarControlSegundos;
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
      comandoEncender: updatedLetrero.comandoEncender || 'HRC1',
      comandoDuracionTemplate: updatedLetrero.comandoDuracionTemplate || 'HRTW',
      duracionDefaultSegundos: this.normalizarSegundos(updatedLetrero.duracionDefaultSegundos),
      mostrarEnControl: updatedLetrero.mostrarEnControl ?? true,
      mostrarCamara: updatedLetrero.mostrarCamara ?? true,
      mostrarBotonEncender: updatedLetrero.mostrarBotonEncender ?? true,
      mostrarControlSegundos: updatedLetrero.mostrarControlSegundos ?? true,
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
