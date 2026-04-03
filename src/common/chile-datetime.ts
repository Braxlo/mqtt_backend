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
 * Etiqueta de día operacional: de 08:00 Chile (inclusive) del día calendario D
 * hasta antes de 08:00 del día D+1 → se etiqueta como día D+1 (igual que el frontend).
 */
export function getDiaOperacionalKeyChile(d: Date): string {
  const base = getCalendarYmdChile(d);
  if (!base) return '';
  const h = getHourChile(d);
  if (Number.isNaN(h)) return base;
  return h >= 8 ? addDaysToYmd(base, 1) : base;
}
