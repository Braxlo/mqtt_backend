import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad de Letrero
 */
@Entity('letreros')
export class Letrero {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({ 
    type: 'varchar', 
    length: 10, 
    default: 'PLC_S',
    comment: 'Tipo de dispositivo de entrada: RPI (Raspberry Pi - datos ya procesados), PLC_S (PLC Siemens - requiere procesamiento), PLC_N (PLC Nitz - pendiente)'
  })
  tipoDispositivo: 'RPI' | 'PLC_S' | 'PLC_N';

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
