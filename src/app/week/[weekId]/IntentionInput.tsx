"use client";

import { useState } from "react";

export function IntentionInput({
  weekId,
  initial,
}: {
  weekId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function blur() {
    if (value === (initial ?? "")) return;
    setSaving(true);
    setSaved(false);
    await fetch(`/api/weeks/${weekId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intention: value || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="mono text-[10px] uppercase text-slate-500">intention</span>
      <input
        className="flex-1 bg-transparent text-sm focus:outline-none"
        placeholder="What's the point of this week?"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={blur}
      />
      {saving && <span className="mono text-[10px] text-slate-400">saving…</span>}
      {saved && <span className="mono text-[10px] text-green-600">saved</span>}
    </div>
  );
}
