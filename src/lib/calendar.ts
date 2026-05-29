// Calendar-grid utilities. Times are stored as minutes since local 00:00.

export const DAY_WINDOW_START = 6 * 60; // 06:00
export const DAY_WINDOW_END = 23 * 60; // 23:00
export const SLOT_MINUTES = 15; // snap granularity
export const PX_PER_MIN = 1.2; // grid density

export function windowHeightPx(
  start = DAY_WINDOW_START,
  end = DAY_WINDOW_END
): number {
  return (end - start) * PX_PER_MIN;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function toHHMM(mins: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(mins)));
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatTimeLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${h12}${period}`
    : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

export function snap(mins: number, slot = SLOT_MINUTES): number {
  return Math.round(mins / slot) * slot;
}

export function clampSpan(
  start: number,
  end: number,
  windowStart = 0,
  windowEnd = 24 * 60
): [number, number] {
  const s = Math.max(windowStart, Math.min(windowEnd - SLOT_MINUTES, start));
  const e = Math.max(s + SLOT_MINUTES, Math.min(windowEnd, end));
  return [s, e];
}

// Default 30-minute slot starting at the next quarter-hour after `now`.
export function nextSlotForDate(now: Date): { start: number; end: number } {
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = snap(mins + SLOT_MINUTES - 1);
  const safeStart = Math.max(DAY_WINDOW_START, Math.min(DAY_WINDOW_END - 30, start));
  return { start: safeStart, end: safeStart + 30 };
}

// Lane packing: greedily place each event into the first lane whose previous
// event has already ended. Per-cluster total lane count is shared by all
// events in that cluster so visual widths match within an overlap group.
export type LaidOut<T> = T & {
  lane: number;
  lanes: number;
  startMinutes: number;
  endMinutes: number;
};

export function packLanes<
  T extends { startMinutes: number; endMinutes: number }
>(events: T[]): LaidOut<T>[] {
  if (events.length === 0) return [];

  const indexed = events.map((e, i) => ({ ...e, _i: i }));
  const sorted = [...indexed].sort((a, b) =>
    a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes
  );

  type Cluster = (typeof sorted)[number][];
  const clusters: Cluster[] = [];
  let cur: Cluster = [];
  let curMaxEnd = -Infinity;
  for (const ev of sorted) {
    if (cur.length === 0 || ev.startMinutes < curMaxEnd) {
      cur.push(ev);
      curMaxEnd = Math.max(curMaxEnd, ev.endMinutes);
    } else {
      clusters.push(cur);
      cur = [ev];
      curMaxEnd = ev.endMinutes;
    }
  }
  if (cur.length) clusters.push(cur);

  const out: LaidOut<T>[] = new Array(events.length) as LaidOut<T>[];
  for (const cluster of clusters) {
    const laneEnds: number[] = [];
    const laneFor = new Map<number, number>(); // ev._i -> lane
    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.startMinutes);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ev.endMinutes);
      } else {
        laneEnds[lane] = ev.endMinutes;
      }
      laneFor.set(ev._i, lane);
    }
    const lanes = laneEnds.length;
    for (const ev of cluster) {
      out[ev._i] = {
        ...events[ev._i],
        lane: laneFor.get(ev._i)!,
        lanes,
      };
    }
  }
  return out;
}
