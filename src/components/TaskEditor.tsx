"use client";

import { useState } from "react";
import { parseHHMM, toHHMM, nextSlotForDate } from "@/lib/calendar";

type Task = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  startMinutes: number | null;
  endMinutes: number | null;
};

const FALLBACK = { start: 9 * 60, end: 9 * 60 + 30 };

export function TaskEditor({
  dayId,
  task,
  onClose,
  onSaved,
  isToday = true,
}: {
  dayId: string;
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
  isToday?: boolean;
}) {
  const defaults = task
    ? { start: task.startMinutes ?? FALLBACK.start, end: task.endMinutes ?? FALLBACK.end }
    : isToday
      ? nextSlotForDate(new Date())
      : FALLBACK;

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [startStr, setStartStr] = useState(toHHMM(defaults.start));
  const [endStr, setEndStr] = useState(toHHMM(defaults.end));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const startMinutes = parseHHMM(startStr);
    const endMinutes = parseHHMM(endStr);
    if (endMinutes - startMinutes < 15) {
      return setErr("End must be at least 15 minutes after start.");
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        startMinutes,
        endMinutes,
      };
      const url = task ? `/api/tasks/${task.id}` : `/api/tasks`;
      const method = task ? "PATCH" : "POST";
      const body = task ? payload : { ...payload, dayId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{task ? "Edit task" : "New task"}</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Title</span>
            <input
              autoFocus
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              }}
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">Start</span>
              <input
                type="time"
                step={900}
                className="mono mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
              />
            </label>
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">End</span>
              <input
                type="time"
                step={900}
                className="mono mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Notes</span>
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600">Priority</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </label>
          {err && (
            <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={busy || !title.trim()}
            onClick={save}
          >
            {task ? "Save" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}
