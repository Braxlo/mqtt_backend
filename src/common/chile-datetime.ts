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
  return h != null ? parseInt(h, 10) : NaN;
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

/** 08:00 Chile del día de la etiqueta (inicio del día operacional). */
export function operacionalDiaInicioUtcDate(ymd: string): Date {
  const p = parseYmd(ymd);
  if (!p) return new Date(NaN);
  return new Date(
    `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T08:00:00-03:00`,
  );
}

/** 07:59:59 Chile del día calendario siguiente (fin inclusivo del día operacional etiquetado `ymd`). */
export function operacionalDiaFinInclusiveUtcDate(ymd: string): Date {
  const next = addDaysToYmd(ymd, 1);
  const p = parseYmd(next);
  if (!p) return new Date(NaN);
  return new Date(
    `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T07:59:59-03:00`,
  );
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
