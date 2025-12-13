import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Escenario as EscenarioEntity, EscenarioTopic as EscenarioTopicEntity } from '../entities';
import { BotonEscenario } from './interfaces/escenario.interface';
import { CreateEscenarioDto } from './dto/create-escenario.dto';
import { UpdateEscenarioDto } from './dto/update-escenario.dto';

/**
 * Servicio para gestionar escenarios/botones
 * Usa TypeORM para persistencia en PostgreSQL
 */
@Injectable()
export class EscenariosService {
  private readonly logger = new Logger(EscenariosService.name);

  constructor(
    @InjectRepository(EscenarioEntity)
    private escenarioRepository: Repository<EscenarioEntity>,
    @InjectRepository(EscenarioTopicEntity)
    private escenarioTopicRepository: Repository<EscenarioTopicEntity>,
  ) {}

  /**
   * Convertir entidad de escenario a formato de interfaz
   */
  private async escenarioToBotonEscenario(escenario: EscenarioEntity): Promise<BotonEscenario> {
    const topics = await this.escenarioTopicRepository.find({
      where: { escenarioId: escenario.id },
      order: { grupo: 'ASC', createdAt: 'ASC' },
    });

    const topics1: string[] = [];
    const topics2: string[] = [];
    let mensaje1 = '';
    let mensaje2 = '';

    topics.forEach((topic) => {
      if (topic.grupo === 1) {
        topics1.push(topic.topic);
        if (!mensaje1 && topic.mensaje) {
          mensaje1 = topic.mensaje;
        }
      } else if (topic.grupo === 2) {
        topics2.push(topic.topic);
        if (!mensaje2 && topic.mensaje) {
          mensaje2 = topic.mensaje;
        }
      }
    });

    return {
      id: escenario.id,
      nombre: escenario.nombre,
      topics1,
      mensaje1,
      topics2,
      mensaje2,
      color: escenario.color || 'red',
    };
  }

  /**
   * Obtener todos los escenarios
   */
  async findAll(): Promise<BotonEscenario[]> {
    const escenarios = await this.escenarioRepository.find({
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      escenarios.map((e) => this.escenarioToBotonEscenario(e)),
    );
  }

  /**
   * Obtener un escenario por ID
   */
  async findOne(id: string): Promise<BotonEscenario> {
    const escenario = await this.escenarioRepository.findOne({
      where: { id },
    });
    if (!escenario) {
      throw new NotFoundException(`Escenario con ID ${id} no encontrado`);
    }
    return this.escenarioToBotonEscenario(escenario);
  }

  /**
   * Crear un nuevo escenario
   */
  async create(createEscenarioDto: CreateEscenarioDto): Promise<BotonEscenario> {
    const escenarioId = Date.now().toString();
    
    // Crear el escenario
    const nuevoEscenario = this.escenarioRepository.create({
      id: escenarioId,
      nombre: createEscenarioDto.nombre,
      color: createEscenarioDto.color || 'red',
    });
    await this.escenarioRepository.save(nuevoEscenario);

    // Crear los topics del grupo 1
    const topics1 = createEscenarioDto.topics1 || [];
    for (const topic of topics1) {
      const escenarioTopic = this.escenarioTopicRepository.create({
        escenarioId,
        grupo: 1,
        topic,
        mensaje: createEscenarioDto.mensaje1,
      });
      await this.escenarioTopicRepository.save(escenarioTopic);
    }

    // Crear los topics del grupo 2
    const topics2 = createEscenarioDto.topics2 || [];
    for (const topic of topics2) {
      const escenarioTopic = this.escenarioTopicRepository.create({
        escenarioId,
        grupo: 2,
        topic,
        mensaje: createEscenarioDto.mensaje2,
      });
      await this.escenarioTopicRepository.save(escenarioTopic);
    }

    this.logger.log(`Escenario creado: ${nuevoEscenario.nombre} (ID: ${escenarioId})`);
    return this.escenarioToBotonEscenario(nuevoEscenario);
  }

  /**
   * Actualizar un escenario existente
   */
  async update(id: string, updateEscenarioDto: UpdateEscenarioDto): Promise<BotonEscenario> {
    const escenario = await this.escenarioRepository.findOne({ where: { id } });
    if (!escenario) {
      throw new NotFoundException(`Escenario con ID ${id} no encontrado`);
    }

    // Actualizar datos básicos del escenario
    if (updateEscenarioDto.nombre) {
      escenario.nombre = updateEscenarioDto.nombre;
    }
    if (updateEscenarioDto.color !== undefined) {
      escenario.color = updateEscenarioDto.color;
    }
    await this.escenarioRepository.save(escenario);

    // Si se actualizan los topics, eliminar los existentes y crear nuevos
    if (updateEscenarioDto.topics1 !== undefined || updateEscenarioDto.topics2 !== undefined) {
      // Eliminar topics existentes
      await this.escenarioTopicRepository.delete({ escenarioId: id });

      // Crear nuevos topics del grupo 1
      if (updateEscenarioDto.topics1 !== undefined) {
        const topics1 = updateEscenarioDto.topics1 || [];
        for (const topic of topics1) {
          const escenarioTopic = this.escenarioTopicRepository.create({
            escenarioId: id,
            grupo: 1,
            topic,
            mensaje: updateEscenarioDto.mensaje1 || '',
          });
          await this.escenarioTopicRepository.save(escenarioTopic);
        }
      }

      // Crear nuevos topics del grupo 2
      if (updateEscenarioDto.topics2 !== undefined) {
        const topics2 = updateEscenarioDto.topics2 || [];
        for (const topic of topics2) {
          const escenarioTopic = this.escenarioTopicRepository.create({
            escenarioId: id,
            grupo: 2,
            topic,
            mensaje: updateEscenarioDto.mensaje2 || '',
          });
          await this.escenarioTopicRepository.save(escenarioTopic);
        }
      }
    } else {
      // Solo actualizar mensajes si no se cambian los topics
      if (updateEscenarioDto.mensaje1 !== undefined) {
        await this.escenarioTopicRepository.update(
          { escenarioId: id, grupo: 1 },
          { mensaje: updateEscenarioDto.mensaje1 },
        );
      }
      if (updateEscenarioDto.mensaje2 !== undefined) {
        await this.escenarioTopicRepository.update(
          { escenarioId: id, grupo: 2 },
          { mensaje: updateEscenarioDto.mensaje2 },
        );
      }
    }

    this.logger.log(`Escenario actualizado: ${escenario.nombre} (ID: ${id})`);
    return this.escenarioToBotonEscenario(escenario);
  }

  /**
   * Eliminar un escenario
   */
  async remove(id: string): Promise<void> {
    const escenario = await this.escenarioRepository.findOne({ where: { id } });
    if (!escenario) {
      throw new NotFoundException(`Escenario con ID ${id} no encontrado`);
    }
    const nombre = escenario.nombre;
    // Los topics se eliminarán automáticamente por CASCADE
    await this.escenarioRepository.remove(escenario);
    this.logger.log(`Escenario eliminado: ${nombre} (ID: ${id})`);
  }
}

