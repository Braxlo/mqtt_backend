import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EscenarioTopic } from './escenario-topic.entity';

/**
 * Entidad de Escenario
 */
@Entity('escenarios')
export class Escenario {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string;

  @OneToMany(() => EscenarioTopic, (topic) => topic.escenario, {
    cascade: true,
    eager: false,
  })
  topics: EscenarioTopic[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

