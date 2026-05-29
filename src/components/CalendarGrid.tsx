"use client";

import { ReactNode } from "react";
import {
  DAY_WINDOW_END,
  DAY_WINDOW_START,
  PX_PER_MIN,
  formatTimeLabel,
} from "@/lib/calendar";

export function CalendarGrid({
  windowStart = DAY_WINDOW_START,
  windowEnd = DAY_WINDOW_END,
  children,
  showHourLabels = true,
}: {
  windowStart?: number;
  windowEnd?: number;
  children: ReactNode;
  showHourLabels?: boolean;
}) {
  const height = (windowEnd - windowStart) * PX_PER_MIN;
  const startHour = Math.floor(windowStart / 60);
  const endHour = Math.ceil(windowEnd / 60);
  // Include both endpoints so the window's last hour (e.g. 12AM at the bottom)
  // gets a labeled gridline, not just an unlabeled edge.
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  return (
    <div className="relative" style={{ height }}>
      {hours.map((h) => {
        const top = (h * 60 - windowStart) * PX_PER_MIN;
        return (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
            style={{ top }}
          >
            {showHourLabels && (
              <span className="mono absolute -top-2 left-0 bg-white pr-1 text-[10px] text-slate-400">
                {formatTimeLabel(h * 60)}
              </span>
            )}
          </div>
        );
      })}
      <div className={showHourLabels ? "absolute inset-y-0 left-12 right-0" : "absolute inset-0"}>
        {children}
      </div>
    </div>
  );
}
