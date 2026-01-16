import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Entidad de Topic Suscrito MQTT
 */
@Entity('mqtt_subscribed_topics')
@Unique(['topic'])
export class MqttSubscribedTopic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'otros' })
  @Index()
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'otras_barreras' | 'otros' | 'prueba';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

