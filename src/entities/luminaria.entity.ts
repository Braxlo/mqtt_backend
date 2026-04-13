import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad de Luminaria
 */
@Entity('luminarias')
export class Luminaria {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 500 })
  @Index()
  topic: string;

  @Column({
    type: 'integer',
    default: 0,
    comment: 'Orden de visualización configurable desde la UI (drag & drop)',
  })
  orden: number;

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
    comment: 'Tipo de batería: 24V (ej. letrero Esperanza Sur) o 48V (luminarias, letrero DES). Define umbrales de alerta (precaución/crítico).'
  })
  tipoBateria: '24V' | '48V';

  @Column({ type: 'varchar', length: 50, nullable: true })
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar';

  @Column({
    type: 'varchar',
    length: 10,
    default: 'HRTW',
    comment: 'Cabecera configurable para comandos temporizados PLC. Ejemplo: HRTW o HRTX.',
  })
  controlHeader: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Controla si la tarjeta de control horario se muestra en dashboard/luminarias/control.',
  })
  mostrarTarjetaControl: boolean;

  @Column({
    type: 'varchar',
    length: 5,
    nullable: true,
    comment: 'Última hora inicio programada (HH:MM) desde la página de control.',
  })
  controlHoraInicio?: string | null;

  @Column({
    type: 'varchar',
    length: 5,
    nullable: true,
    comment: 'Última hora fin programada (HH:MM) desde la página de control.',
  })
  controlHoraFin?: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: 'Última trama enviada por MQTT (control horario).',
  })
  controlUltimaTrama?: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'Instante del último envío exitoso de programación por MQTT.',
  })
  controlUltimaEnviadaAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

