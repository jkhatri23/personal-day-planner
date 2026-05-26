import { formatInTimeZone } from "date-fns-tz";

// Day keys are UTC-midnight Dates that *represent* a calendar date.
// Reading them with getUTCFullYear / getUTCMonth / getUTCDate / getUTCDay
// always reflects the intended calendar fields. NEVER use the local getters
// on a day key — that's TZ-skewed.

const UTC = "UTC";

export function localDayKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function todayKey(): Date {
  return localDayKey(new Date());
}

export function weekStartFromKey(dayKey: Date): Date {
  const day = dayKey.getUTCDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // days since Monday
  const wk = new Date(dayKey);
  wk.setUTCDate(wk.getUTCDate() - offset);
  return wk;
}

export function weekStartForLocal(d: Date = new Date()): Date {
  // Convert a real moment into a dayKey, then compute Monday-based week start.
  return weekStartFromKey(localDayKey(d));
}

// Backwards-compat name used in places that already had a dayKey. Same impl
// as weekStartFromKey for those callsites; passing a moment will TZ-skew, so
// prefer weekStartForLocal for moments.
export const weekStartKey = weekStartForLocal;

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart);
    dt.setUTCDate(dt.getUTCDate() + i);
    return dt;
  });
}

export function addDayKey(dayKey: Date, days: number): Date {
  const d = new Date(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function fmtDayLabel(d: Date): string {
  return formatInTimeZone(d, UTC, "EEE MMM d");
}

export function fmtDayShort(d: Date): string {
  return formatInTimeZone(d, UTC, "EEE");
}

export function fmtDayNum(d: Date): string {
  return formatInTimeZone(d, UTC, "d");
}

export function isPast(d: Date, ref: Date = todayKey()): boolean {
  return d.getTime() < ref.getTime();
}

export function isToday(d: Date, ref: Date = todayKey()): boolean {
  return d.getTime() === ref.getTime();
}
