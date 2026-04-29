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
    comment: 'Tipo de dispositivo de entrada: RPI (datos ya procesados), PLC_S (PLC Siemens), PLC_N (PLC Nitz), DWORD (32 bits IEEE 754)'
  })
  tipoDispositivo: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD';

  @Column({ 
    type: 'varchar', 
    length: 5, 
    default: '48V',
    comment: 'Tipo de batería: 24V (ej. letrero Esperanza Sur) o 48V (letrero DES). Define umbrales de alerta (precaución/crítico).'
  })
  tipoBateria: '24V' | '48V';

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ type: 'varchar', length: 1000, nullable: true, default: '' })
  urlCamara?: string;

  @Column({ type: 'varchar', length: 255, default: 'HRC1' })
  comandoEncender: string;

  @Column({ type: 'varchar', length: 255, default: 'HRTW' })
  comandoDuracionTemplate: string;

  @Column({ type: 'int', default: 60 })
  duracionDefaultSegundos: number;

  @Column({ type: 'boolean', default: true })
  mostrarEnControl: boolean;

  @Column({ type: 'boolean', default: true })
  mostrarCamara: boolean;

  @Column({ type: 'boolean', default: true })
  mostrarBotonEncender: boolean;

  @Column({ type: 'boolean', default: true })
  mostrarControlSegundos: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
