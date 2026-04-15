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

  @Column({ type: 'text', name: 'comando_enclavar_arriba', nullable: true })
  comandoEnclavarArriba?: string;

  @Column({ type: 'text', name: 'comando_enclavar_arriba_off', nullable: true })
  comandoEnclavarArribaOff?: string;

  @Column({ type: 'text', name: 'comando_estado', nullable: true })
  comandoEstado?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  funcion?: 'entrada' | 'salida' | 'ambas';

  @Column({ type: 'integer', default: 0 })
  orden: number;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'PLC_S',
    comment: 'Tipo de dispositivo de entrada: RPI (datos ya procesados), PLC_S (PLC Siemens), PLC_N (PLC Nitz), DWORD (32 bits IEEE 754)',
  })
  tipoDispositivo: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD';

  @Column({ 
    type: 'varchar', 
    length: 5, 
    default: '48V',
    comment: 'Tipo de batería: 24V o 48V. Define umbrales de alerta para el reporte de energía (precaución/crítico).'
  })
  tipoBateria: '24V' | '48V';

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

