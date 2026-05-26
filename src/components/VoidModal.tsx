"use client";

import { useState } from "react";

export function VoidModal({
  task,
  onClose,
  onDone,
}: {
  task: { id: string; title: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Void task</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cancel <span className="font-medium">{task.title}</span> with a written
          reason (counts against your weekly void budget).
        </p>
        <textarea
          autoFocus
          className="mt-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          rows={3}
          placeholder="Why are you voiding this? (≥10 chars)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="mt-1 mono text-[11px] text-slate-400">{reason.length}/10 min</p>
        {err && (
          <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={busy || reason.trim().length < 10}
            onClick={submit}
          >
            Void
          </button>
        </div>
      </div>
    </div>
  );
}
