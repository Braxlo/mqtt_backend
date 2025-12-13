import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Escenario } from './escenario.entity';

/**
 * Entidad de Topic de Escenario
 */
@Entity('escenario_topics')
@Unique(['escenarioId', 'grupo', 'topic'])
export class EscenarioTopic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, name: 'escenario_id' })
  @Index()
  escenarioId: string;

  @ManyToOne(() => Escenario, (escenario) => escenario.topics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'escenario_id' })
  escenario: Escenario;

  @Column({ type: 'integer' })
  @Index()
  grupo: number; // 1 o 2 para topics1 y topics2

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({ type: 'text', nullable: true })
  mensaje: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

