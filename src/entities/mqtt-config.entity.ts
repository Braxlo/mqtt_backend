import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entidad de Configuración MQTT
 * Solo puede haber una configuración activa
 */
@Entity('mqtt_config')
export class MqttConfig {
  @PrimaryColumn({ type: 'varchar', length: 50, default: 'default' })
  id: string = 'default';

  @Column({ type: 'varchar', length: 500, nullable: true })
  brokerUrl: string | null;

  @Column({ type: 'boolean', default: false })
  autoConnect: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

