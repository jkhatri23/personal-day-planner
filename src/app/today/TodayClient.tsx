"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Plus, Pencil, Trash2 } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import { TaskEditor } from "@/components/TaskEditor";
import { VoidModal } from "@/components/VoidModal";
import { CalendarGrid } from "@/components/CalendarGrid";
import { CalendarEventBlock } from "@/components/CalendarEventBlock";
import { packLanes, formatTimeLabel } from "@/lib/calendar";
import { AppSettings } from "@/lib/settings";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  startMinutes: number | null;
  endMinutes: number | null;
  status: string;
  rescheduleCount: number;
  voidReason: string | null;
  position: number;
};

type DayDebt = { id: string; amountCents: number; settledAt: Date | null } | null;

const UNLOCKS_PER_DAY = 1;

export function TodayClient({
  initialTasks,
  dayDebt,
  dayId,
  weekId,
  lockedAt,
  unlockCount,
  settings,
}: {
  initialTasks: Task[];
  dayDebt: DayDebt;
  dayId: string;
  weekId: string;
  lockedAt: Date | null;
  unlockCount: number;
  settings: AppSettings;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<Task | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = !!lockedAt;
  const unlocksLeft = Math.max(0, UNLOCKS_PER_DAY - unlockCount);
  const dayAmountLabel = formatCents(settings.defaultAmountCents);

  const { scheduled, unscheduled } = useMemo(() => {
    const sched = initialTasks.filter(
      (t) => t.startMinutes != null && t.endMinutes != null
    ) as (Task & { startMinutes: number; endMinutes: number })[];
    const unsched = initialTasks.filter(
      (t) => t.startMinutes == null || t.endMinutes == null
    );
    return { scheduled: packLanes(sched), unscheduled: unsched };
  }, [initialTasks]);

  const committedMins = scheduled
    .filter((t) => t.status !== "VOIDED")
    .reduce((s, t) => s + (t.endMinutes - t.startMinutes), 0);

  async function call(url: string, init?: RequestInit) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
      return await res.json();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete(t: Task) {
    await call(`/api/tasks/${t.id}/complete`, { method: "POST" });
  }

  async function deleteTask(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await call(`/api/tasks/${t.id}`, { method: "DELETE" });
  }

  async function resize(
    t: Task,
    next: { startMinutes: number; endMinutes: number }
  ) {
    await call(`/api/tasks/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify(next),
    });
  }

  async function lockDay() {
    setConfirmLock(false);
    await call(`/api/days/${dayId}/lock`, { method: "POST" });
  }

  async function unlockDay() {
    setConfirmUnlock(false);
    await call(`/api/days/${dayId}/unlock`, { method: "POST" });
  }

  return (
    <section className="space-y-4">
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">{dayAmountLabel}/day rule:</span>{" "}
        miss even one task at end-of-day and you owe {dayAmountLabel} for the whole
        day. (GoFundMe bills in USD — that's roughly $10 CAD.) Finish them all to
        owe nothing.
      </div>

      {dayDebt && (
        <div
          className={cn(
            "rounded border px-3 py-2 text-sm",
            dayDebt.settledAt
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {dayDebt.settledAt ? (
            `Today's ${formatCents(dayDebt.amountCents)} debt is settled.`
          ) : (
            <>
              Today's {formatCents(dayDebt.amountCents)} debt is open.{" "}
              <a href="/debts" className="font-semibold underline">
                Upload your GoFundMe confirmation →
              </a>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            disabled={locked || busy}
            onClick={() => setCreating(true)}
          >
            <Plus className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Add task
          </button>
          {committedMins > 0 && (
            <span className="mono text-xs text-slate-500">
              committed {Math.floor(committedMins / 60)}h {committedMins % 60}m
            </span>
          )}
          {committedMins > 360 && (
            <span className="mono text-xs text-amber-700">over-planning (&gt; 6h)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <span className="mono inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                <Lock className="h-3 w-3" /> locked
              </span>
              {unlocksLeft > 0 ? (
                <button
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                  disabled={busy}
                  onClick={() => setConfirmUnlock(true)}
                >
                  <Unlock className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                  Unlock ({unlocksLeft} left)
                </button>
              ) : (
                <span className="mono text-[11px] text-slate-500" title="One unlock per day. You've used yours.">
                  no unlocks left
                </span>
              )}
            </>
          ) : (
            <>
              <button
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                disabled={busy || scheduled.length + unscheduled.length === 0}
                onClick={() => setConfirmLock(true)}
              >
                <Lock className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
                Lock schedule
              </button>
              {unlockCount > 0 && (
                <span className="mono text-[11px] text-slate-500" title="One unlock per day. You've used it — re-locking is fine, but you can't unlock again.">
                  unlock used
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded border border-slate-200 bg-white p-3">
        <CalendarGrid>
          {scheduled.length === 0 && (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No tasks yet. Click "Add task" to schedule one.
            </div>
          )}
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
              locked={locked}
              onClick={(task) => {
                if (locked) return;
                const full = initialTasks.find((x) => x.id === task.id);
                if (full) setEditing(full);
              }}
              onToggleComplete={(task) => {
                const full = initialTasks.find((x) => x.id === task.id);
                if (full) toggleComplete(full);
              }}
              onResize={(task, next) => {
                const full = initialTasks.find((x) => x.id === task.id);
                if (full) resize(full, next);
              }}
            />
          ))}
        </CalendarGrid>
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="mono text-[10px] uppercase text-amber-800">
            unscheduled ({unscheduled.length})
          </p>
          <p className="text-xs text-amber-700">
            These need a time slot before you can lock the day.
          </p>
          <ul className="mt-2 space-y-1">
            {unscheduled.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded border border-amber-300 bg-white px-2 py-1"
              >
                <span className="text-sm">{t.title}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded p-1 text-slate-500 hover:bg-amber-100"
                    onClick={() => setEditing(t)}
                    aria-label="Edit"
                    disabled={locked}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1 text-slate-500 hover:bg-amber-100"
                    onClick={() => deleteTask(t)}
                    aria-label="Delete"
                    disabled={locked}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(creating || editing) && (
        <TaskEditor
          dayId={dayId}
          task={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => router.refresh()}
        />
      )}

      {voiding && (
        <VoidModal
          task={voiding}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null);
            router.refresh();
          }}
        />
      )}

      {confirmLock && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="font-semibold">Lock the schedule?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Once locked you can't add, move, or resize tasks today. You'll
              still be able to check things off as you go. Reckoning at
              end-of-day works as usual.
            </p>
            {unlocksLeft > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                You'll have {unlocksLeft} unlock left if you need to adjust later
                — one per day, total.
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                You've already used your one unlock for today. Re-locking is
                final — no more unlocks until tomorrow.
              </p>
            )}
            <ul className="mt-3 mono text-xs text-slate-500">
              {scheduled.map((t) => (
                <li key={t.id}>
                  {formatTimeLabel(t.startMinutes)}–{formatTimeLabel(t.endMinutes)} ·{" "}
                  {t.title}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setConfirmLock(false)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                onClick={lockDay}
              >
                Lock it
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUnlock && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="font-semibold">Use your unlock for today?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You get exactly one unlock per day. After this, you can re-lock
              when you're ready, but you can't unlock again — the schedule is
              final until reckoning.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setConfirmUnlock(false)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                onClick={unlockDay}
              >
                Use my unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
