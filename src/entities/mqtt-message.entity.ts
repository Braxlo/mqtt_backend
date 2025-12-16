import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad de Mensaje MQTT
 */
@Entity('mqtt_messages')
export class MqttMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'int', nullable: true })
  @Index()
  userId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string | null;
}

