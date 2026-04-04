/**
 * Fechas/horas en America/Santiago (misma lógica que el frontend: día operacional 08:00→08:00).
 */

export const TZ_CHILE = 'America/Santiago';

export function formatFechaHoraChile(d: Date): string {
  return d.toLocaleString('es-CL', {
    timeZone: TZ_CHILE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** YYYY-MM-DD calendario en Chile */
export function getCalendarYmdChile(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ_CHILE });
}

export function getHourChile(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_CHILE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value;
  if (h == null) return NaN;
  const n = parseInt(h, 10);
  if (Number.isNaN(n)) return NaN;
  /** Algunos motores devuelven 24 en medianoche; normalizar a 0. */
  return n === 24 ? 0 : n;
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Etiqueta = día calendario en que **empieza** el turno a las 08:00 (igual que el frontend).
 * Ventana (en informes): ese día 08:00 → día siguiente 08:00 (24 h; en datos: hasta 07:59:59 inclusive).
 */
export function getDiaOperacionalKeyChile(d: Date): string {
  const base = getCalendarYmdChile(d);
  if (!base) return '';
  const h = getHourChile(d);
  if (Number.isNaN(h)) return base;
  return h >= 8 ? base : addDaysToYmd(base, -1);
}

/** Misma convención que el frontend: 24 horas en orden de turno 08:00 … 08:00 del día siguiente. */
export const HORAS_RELOJ_ORDEN_OPERATIVO: readonly number[] = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7,
];

/** De la hora más reciente del turno a la más antigua (tablas / Excel con lo actual arriba). */
export const HORAS_RELOJ_ORDEN_RECiente_PRIMERO: readonly number[] = [
  7, 6, 5, 4, 3, 2, 1, 0, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8,
];

export function fechaCalendarioYmdParaHoraEnVentanaOperativa(diaKeyYmd: string, horaReloj: number): string {
  if (horaReloj >= 8 && horaReloj <= 23) return diaKeyYmd;
  if (horaReloj >= 0 && horaReloj <= 7) return addDaysToYmd(diaKeyYmd, 1);
  return diaKeyYmd;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Instante UTC que corresponde a esta hora de pared en Chile (respeta DST −3/−4 de IANA).
 * No usar offset fijo: en abril (invierno austral) Chile suele estar en −4 y un −3 fijo descuadra ventanas y horas en Excel.
 */
export function chileWallTimeToUtcDate(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const base = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  for (const off of ['-04:00', '-03:00'] as const) {
    const candidate = new Date(base + off);
    if (Number.isNaN(candidate.getTime())) continue;
    if (chileWallTimeMatches(candidate, y, m, d, hour, minute, second)) {
      return candidate;
    }
  }
  return new Date(base + '-03:00');
}

function chileWallTimeMatches(
  dt: Date,
  y: number,
  mo: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  const ymd = getCalendarYmdChile(dt);
  const [yy, mm, dd] = ymd.split('-').map((x) => parseInt(x, 10));
  if (yy !== y || mm !== mo || dd !== day) return false;
  const h = getHourChile(dt);
  if (h !== hour) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_CHILE,
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(dt);
  const mi = parseInt(parts.find((p) => p.type === 'minute')?.value ?? 'NaN', 10);
  const s = parseInt(parts.find((p) => p.type === 'second')?.value ?? 'NaN', 10);
  return mi === minute && s === second;
}

/** 08:00 Chile del día de la etiqueta (inicio del día operacional). */
export function operacionalDiaInicioUtcDate(ymd: string): Date {
  const p = parseYmd(ymd);
  if (!p) return new Date(NaN);
  return chileWallTimeToUtcDate(p.y, p.m, p.d, 8, 0, 0);
}

/** 07:59:59 Chile del día calendario siguiente (fin inclusivo del día operacional etiquetado `ymd`). */
export function operacionalDiaFinInclusiveUtcDate(ymd: string): Date {
  const next = addDaysToYmd(ymd, 1);
  const p = parseYmd(next);
  if (!p) return new Date(NaN);
  return chileWallTimeToUtcDate(p.y, p.m, p.d, 7, 59, 59);
}

/** Rango de timestamps para filtrar por etiquetas de día operacional Desde…Hasta (inclusive). */
export function rangoOperacionalQueryUtc(fechaInicioYmd: string, fechaFinYmd: string): { tMin: Date; tMax: Date } {
  return {
    tMin: operacionalDiaInicioUtcDate(fechaInicioYmd),
    tMax: operacionalDiaFinInclusiveUtcDate(fechaFinYmd),
  };
}

/** Etiquetas YYYY-MM-DD consecutivas entre dos fechas (inclusive). */
export function enumerarEtiquetasYmdInclusive(inicio: string, fin: string): string[] {
  if (!inicio || !fin) return [];
  const a = inicio <= fin ? inicio : fin;
  const b = inicio <= fin ? fin : inicio;
  const out: string[] = [];
  let cur = a;
  for (;;) {
    out.push(cur);
    if (cur === b) break;
    cur = addDaysToYmd(cur, 1);
  }
  return out;
}

/** Etiqueta = día de inicio 08:00; en texto: ventana 08:00 → 08:00 del día siguiente (24 h). */
export function formatoVentanaOperativaCorta(diaKeyYmd: string): string {
  const next = addDaysToYmd(diaKeyYmd, 1);
  const fmt = (ymd: string) => {
    const p = parseYmd(ymd);
    if (!p) return ymd;
    return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
  };
  return `${fmt(diaKeyYmd)} 08:00 → ${fmt(next)} 08:00`;
}

/**
 * ¿La marca de tiempo cae en la ventana del día operacional `diaKeyYmd`?
 * Desde 08:00 del día etiqueta hasta 07:59:59 del día calendario siguiente.
 */
export function registroEnVentanaOperacionalEtiqueta(isoOrDate: string | Date, diaKeyYmd: string): boolean {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const t = d.getTime();
  if (Number.isNaN(t)) return false;
  const { tMin, tMax } = rangoOperacionalQueryUtc(diaKeyYmd, diaKeyYmd);
  return t >= tMin.getTime() && t <= tMax.getTime();
}
