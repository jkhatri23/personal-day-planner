"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDayShort, fmtDayNum, isToday, todayKey } from "@/lib/dates";
import { TaskEditor } from "@/components/TaskEditor";
import { IntentionInput } from "./IntentionInput";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  status: string;
  position: number;
  rescheduleCount: number;
  voidReason: string | null;
  debt: { id: string; amountCents: number; settledAt: Date | null } | null;
};
type Day = { id: string; date: Date; tasks: Task[]; reckonedAt: Date | null };
type Week = { id: string; startDate: Date; intention: string | null; days: Day[] };

export function WeekClient({ week }: { week: Week }) {
  const router = useRouter();
  const [dragErr, setDragErr] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const today = todayKey();

  async function onDragEnd(ev: DragEndEvent) {
    const taskId = String(ev.active.id);
    const toDayId = ev.over?.id ? String(ev.over.id) : null;
    if (!toDayId) return;
    const fromDay = week.days.find((d) => d.tasks.some((t) => t.id === taskId));
    if (!fromDay || fromDay.id === toDayId) return;

    setDragErr(null);
    const res = await fetch(`/api/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toDayId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setDragErr(j.error ?? `HTTP ${res.status}`);
    }
    router.refresh();
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <IntentionInput weekId={week.id} initial={week.intention} />
      {dragErr && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dragErr}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {week.days.map((d) => (
          <DayColumn
            key={d.id}
            day={d}
            isToday={isToday(d.date, today)}
            onAdd={() => setEditingDay(d.id)}
          />
        ))}
      </div>

      {editingDay && (
        <TaskEditor
          dayId={editingDay}
          task={null}
          onClose={() => setEditingDay(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </DndContext>
  );
}

function DayColumn({
  day,
  isToday,
  onAdd,
}: {
  day: Day;
  isToday: boolean;
  onAdd: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: day.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[260px] flex-col rounded border bg-white",
        isOver ? "border-slate-900" : "border-slate-200",
        isToday && "ring-1 ring-slate-900/40"
      )}
    >
      <header className="flex items-baseline justify-between border-b border-slate-100 px-3 py-2">
        <div>
          <p className="mono text-[10px] uppercase tracking-wide text-slate-500">
            {fmtDayShort(day.date)}
          </p>
          <p className={cn("mono text-lg", isToday && "font-semibold")}>
            {fmtDayNum(day.date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {day.reckonedAt && (
            <span className="mono text-[10px] uppercase text-green-700">reckoned</span>
          )}
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            onClick={onAdd}
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>
      <ul className="flex-1 space-y-1 p-2">
        {day.tasks.length === 0 && (
          <li className="px-1 py-3 text-center text-xs text-slate-300">empty</li>
        )}
        {day.tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </ul>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: task.status !== "PLANNED",
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded border border-slate-200 px-2 py-1.5 text-xs",
        isDragging && "opacity-50",
        task.status === "PLANNED" && "cursor-grab bg-white hover:border-slate-400",
        task.status === "DONE" && "bg-green-50 text-green-800 line-through decoration-green-700/40",
        task.status === "VOIDED" && "bg-slate-50 text-slate-400 line-through",
        task.status === "OWED" && "bg-red-50 text-red-700",
        task.status === "SETTLED" && "bg-slate-50 text-slate-500"
      )}
    >
      <div className="flex items-baseline gap-1">
        {task.priority === "HIGH" && (
          <span className="mono text-[9px] uppercase text-red-600">H</span>
        )}
        {task.priority === "LOW" && (
          <span className="mono text-[9px] uppercase text-slate-400">L</span>
        )}
        <span className="truncate">{task.title}</span>
      </div>
      {task.estimatedMins != null && (
        <span className="mono text-[10px] text-slate-400">{task.estimatedMins}m</span>
      )}
      {task.status === "OWED" && task.debt && (
        <span className="mono ml-1 text-[10px]">${(task.debt.amountCents / 100).toFixed(0)}</span>
      )}
    </li>
  );
}
