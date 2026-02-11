import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad para almacenar posiciones de luminarias en el mapa
 * Reemplaza el almacenamiento en localStorage del frontend
 */
@Entity('luminarias_mapa')
export class LuminariaMapa {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  luminariaId: string; // ID de la luminaria (puede ser múltiple separado por comas)

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  numero: number; // Número de la luminaria para mostrar en el icono

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitud: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitud: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  conjuntoId?: string; // ID del conjunto si está agrupada con otras

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
