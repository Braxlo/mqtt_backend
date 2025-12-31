import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad de Barrera
 */
@Entity('barreras')
export class Barrera {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({ type: 'text', name: 'url_camara' })
  urlCamara: string;

  @Column({ type: 'text', name: 'comando_abrir' })
  comandoAbrir: string;

  @Column({ type: 'text', name: 'comando_cerrar' })
  comandoCerrar: string;

  @Column({ type: 'text', name: 'comando_estado', nullable: true })
  comandoEstado?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  funcion?: 'entrada' | 'salida' | 'ambas';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

