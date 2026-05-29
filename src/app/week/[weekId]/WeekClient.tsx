"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock as LockIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDayShort, fmtDayNum, isToday, todayKey } from "@/lib/dates";
import { TaskEditor } from "@/components/TaskEditor";
import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarEventBlock } from "@/components/CalendarEventBlock";
import { packLanes } from "@/lib/calendar";
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
  startMinutes: number | null;
  endMinutes: number | null;
};
type DayDebt = { id: string; amountCents: number; settledAt: Date | null } | null;
type Day = {
  id: string;
  date: Date;
  tasks: Task[];
  reckonedAt: Date | null;
  lockedAt: Date | null;
  debt: DayDebt;
};
type Week = { id: string; startDate: Date; intention: string | null; days: Day[] };

export function WeekClient({ week }: { week: Week }) {
  const router = useRouter();
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const today = todayKey();

  return (
    <>
      <IntentionInput weekId={week.id} initial={week.intention} />
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <div className="grid min-w-[900px] grid-cols-7 divide-x divide-slate-100">
          {week.days.map((d) => (
            <DayColumn
              key={d.id}
              day={d}
              isToday={isToday(d.date, today)}
              onAdd={() => setEditingDay(d.id)}
            />
          ))}
        </div>
      </div>

      {editingDay && (
        <TaskEditor
          dayId={editingDay}
          task={null}
          isToday={false}
          onClose={() => setEditingDay(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </>
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
  const scheduled = useMemo(() => {
    const sched = day.tasks.filter(
      (t) => t.startMinutes != null && t.endMinutes != null
    ) as (Task & { startMinutes: number; endMinutes: number })[];
    return packLanes(sched);
  }, [day.tasks]);

  const unscheduled = day.tasks.filter(
    (t) => t.startMinutes == null || t.endMinutes == null
  );

  const locked = !!day.lockedAt;

  return (
    <div className={cn("flex flex-col", isToday && "bg-slate-50/30")}>
      <header className="flex items-baseline justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
        <div>
          <p className="mono text-[10px] uppercase tracking-wide text-slate-500">
            {fmtDayShort(day.date)}
          </p>
          <p className={cn("mono text-base", isToday && "font-semibold")}>
            {fmtDayNum(day.date)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {locked && (
            <span title="schedule locked">
              <LockIcon className="h-3 w-3 text-slate-500" />
            </span>
          )}
          {day.debt && !day.debt.settledAt && (
            <span className="mono text-[9px] uppercase text-red-700">
              ${(day.debt.amountCents / 100).toFixed(0)} owed
            </span>
          )}
          {day.debt?.settledAt && (
            <span className="mono text-[9px] uppercase text-green-700">settled</span>
          )}
          {!locked && (
            <button
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
              onClick={onAdd}
              aria-label="Add task"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="px-2 py-2">
        <CalendarGrid showHourLabels={false}>
          {scheduled.map((t) => (
            <CalendarEventBlock
              key={t.id}
              task={{
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                startMinutes: t.startMinutes,
                endMinutes: t.endMinutes,
                lane: t.lane,
                lanes: t.lanes,
              }}
              locked
              compact
            />
          ))}
        </CalendarGrid>
        {unscheduled.length > 0 && (
          <p className="mono mt-1 text-[10px] text-amber-700">
            +{unscheduled.length} unscheduled
          </p>
        )}
      </div>
    </div>
  );
}
