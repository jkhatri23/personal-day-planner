"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, Pencil, ArrowRight, AlertTriangle } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import { TaskEditor } from "@/components/TaskEditor";
import { VoidModal } from "@/components/VoidModal";
import { AppSettings } from "@/lib/settings";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  status: string;
  rescheduleCount: number;
  voidReason: string | null;
  position: number;
};

type DayDebt = { id: string; amountCents: number; settledAt: Date | null } | null;

const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function TodayClient({
  initialTasks,
  dayDebt,
  dayId,
  weekId,
  settings,
}: {
  initialTasks: Task[];
  dayDebt: DayDebt;
  dayId: string;
  weekId: string;
  settings: AppSettings;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const r = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        if (r !== 0) return r;
        return a.position - b.position;
      }),
    [tasks]
  );

  const totalMins = sorted
    .filter((t) => t.status !== "VOIDED")
    .reduce((s, t) => s + (t.estimatedMins ?? 0), 0);

  async function call(url: string, init?: RequestInit) {
    setError(null);
    setBusy(url);
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
      setBusy(null);
    }
  }

  async function toggle(t: Task) {
    await call(`/api/tasks/${t.id}/complete`, { method: "POST" });
  }

  async function remove(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await call(`/api/tasks/${t.id}`, { method: "DELETE" });
  }

  async function pushTomorrow(t: Task) {
    const res = await fetch(`/api/weeks/${weekId}`).then((r) => r.json());
    const today = new Date();
    const todayMid = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrow = new Date(todayMid + 86_400_000);
    const target = res.days.find(
      (d: { id: string; date: string }) =>
        new Date(d.date).getTime() === tomorrow.getTime()
    );
    if (!target) {
      setError("Tomorrow isn't in the current week. Plan it from the weekly view.");
      return;
    }
    await call(`/api/tasks/${t.id}/reschedule`, {
      method: "POST",
      body: JSON.stringify({ toDayId: target.id }),
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "n") {
        e.preventDefault();
        setCreating(true);
      } else if (e.key === "j") {
        setCursor((c) => Math.min(sorted.length - 1, c + 1));
      } else if (e.key === "k") {
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "x") {
        const t = sorted[cursor];
        if (t) toggle(t);
      } else if (e.key === "v") {
        const t = sorted[cursor];
        if (t && t.status === "PLANNED") setVoiding(t);
      } else if (e.key === "r") {
        const t = sorted[cursor];
        if (t && t.status === "PLANNED" && t.rescheduleCount < 1) pushTomorrow(t);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted, cursor]);

  const dayAmountLabel = formatCents(settings.defaultAmountCents);

  return (
    <section className="space-y-4">
      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">
          {dayAmountLabel}/day rule:
        </span>{" "}
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

      {totalMins > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="mono">
            committed: {Math.floor(totalMins / 60)}h {totalMins % 60}m
          </span>
          {totalMins > 360 && (
            <span className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> over-planning ({totalMins}m &gt; 6h)
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ul className="divide-y divide-slate-200 rounded border border-slate-200">
        {sorted.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No tasks planned.{" "}
            <button
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
              onClick={() => setCreating(true)}
            >
              Plan your day →
            </button>
          </li>
        )}
        {sorted.map((t, i) => (
          <li
            key={t.id}
            className={cn(
              "group flex items-start gap-3 px-3 py-2.5",
              i === cursor && "bg-slate-50"
            )}
            onMouseEnter={() => setCursor(i)}
          >
            <button
              className="mt-0.5 text-slate-400 hover:text-slate-900 disabled:opacity-40"
              disabled={
                !!busy ||
                t.status === "VOIDED" ||
                t.status === "OWED" ||
                t.status === "SETTLED"
              }
              onClick={() => toggle(t)}
              aria-label="Toggle done"
            >
              {t.status === "DONE" || t.status === "SETTLED" ? (
                <CheckSquare className="h-5 w-5 text-green-600" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={cn(
                    "truncate text-sm",
                    t.status === "DONE" && "text-green-700 line-through decoration-green-700/40",
                    t.status === "VOIDED" && "text-slate-400 line-through",
                    t.status === "OWED" && "text-red-700",
                    t.status === "SETTLED" && "text-slate-500"
                  )}
                >
                  {t.title}
                </span>
                {t.priority === "HIGH" && (
                  <span className="mono text-[10px] uppercase tracking-wide text-red-600">
                    HIGH
                  </span>
                )}
                {t.priority === "LOW" && (
                  <span className="mono text-[10px] uppercase tracking-wide text-slate-400">
                    LOW
                  </span>
                )}
                {t.estimatedMins != null && (
                  <span className="mono text-xs text-slate-400">{t.estimatedMins}m</span>
                )}
                {t.rescheduleCount > 0 && (
                  <span className="mono text-[10px] text-amber-600">·rescheduled</span>
                )}
                {t.status === "OWED" && (
                  <span className="mono text-xs text-red-700">
                    counted toward day's debt
                  </span>
                )}
              </div>
              {t.notes && <p className="mt-0.5 text-xs text-slate-500">{t.notes}</p>}
              {t.voidReason && (
                <p className="mt-0.5 text-xs italic text-slate-400">
                  voided: {t.voidReason}
                </p>
              )}
            </div>
            {t.status === "PLANNED" && (
              <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
                <button
                  className="rounded p-1 hover:bg-slate-200"
                  onClick={() => setEditing(t)}
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 hover:bg-slate-200 disabled:opacity-30"
                  disabled={t.rescheduleCount >= 1}
                  title={t.rescheduleCount >= 1 ? "Already rescheduled once" : "Push to tomorrow"}
                  onClick={() => pushTomorrow(t)}
                  aria-label="Push to tomorrow"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 hover:bg-slate-200"
                  onClick={() => setVoiding(t)}
                  aria-label="Void"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <button
          className="rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => setCreating(true)}
        >
          + Add task <span className="mono ml-2 text-slate-400">n</span>
        </button>
        <span className="mono">
          shortcuts: n new · j/k nav · x done · r push · v void
        </span>
      </div>

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
    </section>
  );
}
