"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock as LockIcon } from "lucide-react";
import {
  DAY_WINDOW_END,
  DAY_WINDOW_START,
  PX_PER_MIN,
  SLOT_MINUTES,
  clampSpan,
  formatTimeLabel,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startMinutes: number;
  endMinutes: number;
  lane: number;
  lanes: number;
};

type DragState = {
  kind: "top" | "bottom";
  pointerId: number;
  startY: number;
  origStart: number;
  origEnd: number;
  deltaMin: number;
};

const statusClass = (s: string) =>
  s === "DONE" || s === "SETTLED"
    ? "bg-green-100 border-green-300 text-green-800"
    : s === "VOIDED"
      ? "bg-slate-100 border-slate-300 text-slate-400 line-through"
      : s === "OWED"
        ? "bg-red-50 border-red-300 text-red-800"
        : "bg-white border-slate-300 text-slate-800";

export function CalendarEventBlock({
  task,
  windowStart = DAY_WINDOW_START,
  windowEnd = DAY_WINDOW_END,
  locked,
  onClick,
  onToggleComplete,
  onResize,
  compact,
}: {
  task: Task;
  windowStart?: number;
  windowEnd?: number;
  locked: boolean;
  onClick?: (t: Task) => void;
  onToggleComplete?: (t: Task) => void;
  onResize?: (t: Task, next: { startMinutes: number; endMinutes: number }) => void;
  compact?: boolean;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);

  const start = drag
    ? drag.kind === "top"
      ? Math.min(drag.origEnd - SLOT_MINUTES, drag.origStart + drag.deltaMin)
      : drag.origStart
    : task.startMinutes;
  const end = drag
    ? drag.kind === "bottom"
      ? Math.max(drag.origStart + SLOT_MINUTES, drag.origEnd + drag.deltaMin)
      : drag.origEnd
    : task.endMinutes;

  const top = (start - windowStart) * PX_PER_MIN;
  const height = Math.max((end - start) * PX_PER_MIN, 22);
  const widthPct = 100 / Math.max(1, task.lanes);
  const leftPct = task.lane * widthPct;

  const style: CSSProperties = {
    top,
    height,
    left: `${leftPct}%`,
    width: `calc(${widthPct}% - 2px)`,
  };

  function startDrag(kind: "top" | "bottom", e: React.PointerEvent) {
    if (locked || !onResize) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind,
      pointerId: e.pointerId,
      startY: e.clientY,
      origStart: task.startMinutes,
      origEnd: task.endMinutes,
      deltaMin: 0,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const deltaPx = e.clientY - drag.startY;
    const deltaMin = Math.round(deltaPx / PX_PER_MIN / SLOT_MINUTES) * SLOT_MINUTES;
    if (deltaMin !== drag.deltaMin) setDrag({ ...drag, deltaMin });
  }

  function endDrag(e: React.PointerEvent) {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
    const committedStart =
      drag.kind === "top"
        ? Math.min(drag.origEnd - SLOT_MINUTES, drag.origStart + drag.deltaMin)
        : drag.origStart;
    const committedEnd =
      drag.kind === "bottom"
        ? Math.max(drag.origStart + SLOT_MINUTES, drag.origEnd + drag.deltaMin)
        : drag.origEnd;
    const [s, eMin] = clampSpan(committedStart, committedEnd, windowStart, windowEnd);
    if (s !== task.startMinutes || eMin !== task.endMinutes) {
      onResize?.(task, { startMinutes: s, endMinutes: eMin });
    }
    setDrag(null);
  }

  // Defensive: if pointer is canceled (e.g. user scrolls away), reset drag.
  useEffect(() => {
    if (!drag) return;
    const cancel = () => setDrag(null);
    window.addEventListener("pointercancel", cancel);
    return () => window.removeEventListener("pointercancel", cancel);
  }, [drag]);

  const tooShort = end - start < 30;

  return (
    <div
      ref={blockRef}
      className={cn(
        "absolute overflow-hidden rounded border text-[11px] shadow-sm select-none",
        statusClass(task.status),
        drag && "ring-2 ring-slate-900/30",
        compact ? "px-1" : "px-1.5"
      )}
      style={style}
      onClick={(e) => {
        if (drag) return;
        if (e.target instanceof HTMLElement && e.target.closest("[data-handle]")) return;
        onClick?.(task);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
    >
      {/* top resize handle */}
      <div
        data-handle="top"
        className={cn(
          "absolute inset-x-0 top-0 h-1.5",
          !locked && onResize ? "cursor-ns-resize hover:bg-slate-900/10" : ""
        )}
        onPointerDown={(e) => startDrag("top", e)}
      />
      {/* body */}
      <div className="pt-1 pb-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className={cn("truncate font-medium", tooShort && "text-[10px] leading-tight")}>
              {task.title}
            </p>
            {!tooShort && (
              <p className="mono text-[10px] opacity-70">
                {formatTimeLabel(start)}–{formatTimeLabel(end)}
                {task.priority === "HIGH" ? " · HIGH" : ""}
              </p>
            )}
          </div>
          {onToggleComplete && (
            <button
              type="button"
              data-handle="check"
              className={cn(
                "shrink-0 rounded p-0.5 transition",
                task.status === "DONE" || task.status === "SETTLED"
                  ? "text-green-700"
                  : "text-slate-400 hover:text-slate-900",
                task.status === "VOIDED" && "pointer-events-none opacity-50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(task);
              }}
              aria-label="Toggle complete"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* bottom resize handle */}
      <div
        data-handle="bottom"
        className={cn(
          "absolute inset-x-0 bottom-0 h-1.5",
          !locked && onResize ? "cursor-ns-resize hover:bg-slate-900/10" : ""
        )}
        onPointerDown={(e) => startDrag("bottom", e)}
      />
      {locked && (
        <LockIcon className="pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 opacity-40" />
      )}
    </div>
  );
}
