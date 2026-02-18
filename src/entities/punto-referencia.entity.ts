import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad de Punto de Referencia HKN
 * Representa infraestructura fija como garitas, oficinas, contenedores
 */
@Entity('puntos_referencia')
export class PuntoReferencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 10 })
  @Index()
  codigo: string; // GC, GN, GS, GH, etc.

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  @Index()
  latitud: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  @Index()
  longitud: number;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tipo: string | null; // 'garita', 'oficina', 'contenedor', etc.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
