"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { AppSettings } from "@/lib/settings";

export function SettingsClient({ initial }: { initial: AppSettings }) {
  const [defaultDollars, setDefaultDollars] = useState(initial.defaultAmountCents / 100);
  const [voidBudget, setVoidBudget] = useState(initial.weeklyVoidBudget);
  const [tz, setTz] = useState(initial.timezone);
  const [urls, setUrls] = useState<string[]>(initial.gofundmeUrls);
  const [newUrl, setNewUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(payload: Partial<{ defaultAmountCents: number; weeklyVoidBudget: number; timezone: string; gofundmeUrls: string[] }>) {
    setMsg(null);
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setMsg("Saved.");
      setTimeout(() => setMsg(null), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    const next = [...new Set([...urls, trimmed])];
    setUrls(next);
    setNewUrl("");
    try {
      await save({ gofundmeUrls: next });
    } catch {
      setUrls(urls); // revert
    }
  }

  async function removeUrl(u: string) {
    const next = urls.filter((x) => x !== u);
    setUrls(next);
    await save({ gofundmeUrls: next });
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </div>
      )}

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold">Daily donation amount</h2>
        <p className="text-xs text-slate-500">
          Flat amount per day. Owed if any task ends up un-done. Min $5, max $100.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-slate-500">$</span>
          <input
            type="number"
            min={5}
            max={100}
            step={1}
            className="mono w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={defaultDollars}
            onChange={(e) => setDefaultDollars(Number(e.target.value))}
            onBlur={() => save({ defaultAmountCents: Math.round(defaultDollars * 100) })}
          />
          <span className="mono text-xs text-slate-400">per day</span>
        </div>
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold">Weekly void budget</h2>
        <p className="text-xs text-slate-500">
          Max tasks you can void per week before they must be done or owed.
        </p>
        <input
          type="number"
          min={0}
          max={7}
          className="mono mt-3 w-20 rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={voidBudget}
          onChange={(e) => setVoidBudget(Number(e.target.value))}
          onBlur={() => save({ weeklyVoidBudget: voidBudget })}
        />
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold">Timezone</h2>
        <p className="text-xs text-slate-500">
          IANA tz name (e.g. America/Toronto).
        </p>
        <input
          className="mono mt-3 w-64 rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          onBlur={() => save({ timezone: tz })}
        />
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold">GoFundMe campaigns</h2>
        <p className="text-xs text-slate-500">
          At least one is required. You'll pick from these when accepting a debt.
        </p>
        <ul className="mt-3 space-y-1">
          {urls.length === 0 && (
            <li className="text-xs text-red-700">
              No campaigns saved. Add at least one before owing.
            </li>
          )}
          {urls.map((u) => (
            <li
              key={u}
              className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1"
            >
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="mono truncate text-xs text-slate-700 hover:underline"
              >
                {u}
              </a>
              <button
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => removeUrl(u)}
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="mono flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="https://www.gofundme.com/f/your-campaign"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addUrl();
            }}
          />
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={saving || !newUrl.trim()}
            onClick={addUrl}
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
