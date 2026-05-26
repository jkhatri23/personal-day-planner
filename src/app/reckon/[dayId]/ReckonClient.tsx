"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, DollarSign, AlertTriangle } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

type PlannedTask = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  rescheduleCount: number;
};

type Choice =
  | { kind: "DONE"; confirmed?: boolean }
  | { kind: "VOID"; reason: string }
  | { kind: "OWE"; amountCents: number; gofundmeUrl?: string }
  | { kind: null };

type DayInfo = {
  id: string;
  date: Date;
  dateLabel: string;
  planned: PlannedTask[];
  voidsUsedThisWeek: number;
  weeklyVoidBudget: number;
  defaultAmountCents: number;
  defaultAmountLabel: string;
  savedGofundmeUrls: string[];
};

type OpenDebt = {
  id: string;
  amountCents: number;
  amountLabel: string;
  gofundmeUrl: string | null;
  taskTitle: string;
  dayLabel: string;
};

export function ReckonClient({
  day,
  openDebts,
}: {
  day: DayInfo;
  openDebts: OpenDebt[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(day.planned.map((t) => [t.id, { kind: null }] as const))
  );
  const [reflection, setReflection] = useState("");
  const [proofs, setProofs] = useState<Record<string, string>>(
    Object.fromEntries(openDebts.map((d) => [d.id, ""] as const))
  );
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"resolve" | "settle">("resolve");
  const [showBackdateWarning, setShowBackdateWarning] = useState<string | null>(null);

  const allResolved = day.planned.every((t) => choices[t.id]?.kind !== null);
  const voidCount = Object.values(choices).filter((c) => c.kind === "VOID").length;
  const voidsRemaining = day.weeklyVoidBudget - day.voidsUsedThisWeek;
  const overVoidBudget = voidCount > voidsRemaining;
  const backdateCount = Object.values(choices).filter((c) => c.kind === "DONE").length;

  function setChoice(taskId: string, c: Choice) {
    setChoices((prev) => ({ ...prev, [taskId]: c }));
  }

  async function submitResolutions() {
    if (!allResolved) {
      setErr("Resolve every task before continuing.");
      return;
    }
    if (overVoidBudget) {
      setErr(
        `You're trying to void ${voidCount} tasks but only ${Math.max(
          voidsRemaining,
          0
        )} remain this week. Mark done or owe instead.`
      );
      return;
    }
    // Require ≥10 chars for void reasons before submit
    for (const t of day.planned) {
      const c = choices[t.id];
      if (c.kind === "VOID" && c.reason.trim().length < 10) {
        setErr(`"${t.title}" needs a void reason of at least 10 characters.`);
        return;
      }
    }

    setSubmitting(true);
    setErr(null);
    try {
      const resolutions = day.planned.map((t) => {
        const c = choices[t.id];
        if (c.kind === "DONE") return { kind: "DONE" as const, taskId: t.id };
        if (c.kind === "VOID")
          return { kind: "VOID" as const, taskId: t.id, reason: c.reason.trim() };
        const owe = c as Extract<Choice, { kind: "OWE" }>;
        return {
          kind: "OWE" as const,
          taskId: t.id,
          amountCents: owe.amountCents,
          gofundmeUrl: owe.gofundmeUrl || null,
        };
      });

      const res = await fetch(`/api/days/${day.id}/reckon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutions,
          reflection: reflection.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // refetch open debts (the just-created ones are included server-side
      // because openDebts query covered date<=today). But to be safe, refresh
      // and then jump to settle step if any debt remains.
      router.refresh();
      const newlyOwed = resolutions.filter((r) => r.kind === "OWE").length;
      if (openDebts.length + newlyOwed > 0) {
        setStep("settle");
      } else {
        router.replace("/today");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function settleAll() {
    setSubmitting(true);
    setErr(null);
    try {
      // We re-fetch the full set of open debts from the server in case new
      // ones were created in submitResolutions().
      const fresh = await fetch("/api/debts?status=OWED").then((r) => r.json());
      const all: OpenDebt[] = fresh.map((d: any) => ({
        id: d.id,
        amountCents: d.amountCents,
        amountLabel: formatCents(d.amountCents),
        gofundmeUrl: d.gofundmeUrl,
        taskTitle: d.task.title,
        dayLabel: new Date(d.task.day.date).toDateString(),
      }));
      for (const d of all) {
        const proof = proofs[d.id]?.trim();
        if (!proof) throw new Error(`Need donation proof for "${d.taskTitle}".`);
        const res = await fetch(`/api/debts/${d.id}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ donationProof: proof }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
      }
      router.replace("/today");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Empty day shortcut
  async function closeEmpty() {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/days/${day.id}/reckon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions: [], reflection: reflection.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.replace("/today");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-6">
          <p className="mono text-xs uppercase tracking-wide text-slate-500">
            end-of-day reckoning
          </p>
          <h1 className="text-3xl font-semibold">{day.dateLabel}</h1>
          <p className="mt-1 text-sm text-slate-600">
            You cannot use the rest of the app until this day is honestly
            resolved. Mark each task done, void it with a reason, or accept
            the debt.
          </p>
        </header>

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{err}</span>
          </div>
        )}

        {step === "resolve" && (
          <>
            {day.planned.length === 0 ? (
              <div className="rounded border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-600">
                  No unresolved tasks for this day. Close it out to continue.
                </p>
                <textarea
                  className="mt-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  rows={2}
                  placeholder="One-line reflection (optional)"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                />
                <button
                  className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={submitting}
                  onClick={closeEmpty}
                >
                  Close day
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3 mono text-xs text-slate-500">
                  void budget: {Math.max(voidsRemaining, 0)} remaining this week
                  {overVoidBudget && (
                    <span className="ml-2 text-red-700">
                      ({voidCount} planned, over budget)
                    </span>
                  )}
                </div>
                <ul className="space-y-3">
                  {day.planned.map((t) => (
                    <li
                      key={t.id}
                      className="rounded border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          {t.notes && (
                            <p className="text-xs text-slate-500">{t.notes}</p>
                          )}
                          <p className="mono mt-0.5 text-[10px] uppercase text-slate-400">
                            {t.priority}
                            {t.estimatedMins ? ` · ${t.estimatedMins}m` : ""}
                            {t.rescheduleCount > 0 ? " · rescheduled" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ChoiceButton
                          active={choices[t.id]?.kind === "DONE"}
                          onClick={() => {
                            if (choices[t.id]?.kind !== "DONE") {
                              setShowBackdateWarning(t.id);
                            } else {
                              setChoice(t.id, { kind: null });
                            }
                          }}
                          color="green"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          label="I actually did this"
                        />
                        <ChoiceButton
                          active={choices[t.id]?.kind === "VOID"}
                          onClick={() =>
                            setChoice(t.id, choices[t.id]?.kind === "VOID"
                              ? { kind: null }
                              : { kind: "VOID", reason: "" }
                            )
                          }
                          color="slate"
                          icon={<XCircle className="h-4 w-4" />}
                          label="Void with reason"
                        />
                        <ChoiceButton
                          active={choices[t.id]?.kind === "OWE"}
                          onClick={() =>
                            setChoice(t.id, choices[t.id]?.kind === "OWE"
                              ? { kind: null }
                              : {
                                  kind: "OWE",
                                  amountCents: day.defaultAmountCents,
                                  gofundmeUrl: day.savedGofundmeUrls[0],
                                }
                            )
                          }
                          color="red"
                          icon={<DollarSign className="h-4 w-4" />}
                          label={`Owe ${day.defaultAmountLabel}`}
                        />
                      </div>

                      {choices[t.id]?.kind === "VOID" && (
                        <textarea
                          autoFocus
                          className="mt-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                          rows={2}
                          placeholder="Why? (≥10 chars)"
                          value={(choices[t.id] as Extract<Choice, { kind: "VOID" }>).reason}
                          onChange={(e) =>
                            setChoice(t.id, { kind: "VOID", reason: e.target.value })
                          }
                        />
                      )}
                      {choices[t.id]?.kind === "OWE" && (
                        <OwePicker
                          choice={choices[t.id] as Extract<Choice, { kind: "OWE" }>}
                          urls={day.savedGofundmeUrls}
                          onChange={(c) => setChoice(t.id, c)}
                        />
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">
                      Reflection (optional)
                    </span>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      rows={2}
                      placeholder="What got in the way?"
                      value={reflection}
                      onChange={(e) => setReflection(e.target.value)}
                    />
                  </label>
                </div>

                {backdateCount > 3 && (
                  <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Backdating {backdateCount} tasks. This will show as a warning
                    on the weekly review — be honest with yourself.
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={!allResolved || overVoidBudget || submitting}
                    onClick={submitResolutions}
                  >
                    Resolve day
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === "settle" && (
          <SettleStep
            openDebts={openDebts}
            proofs={proofs}
            setProofs={setProofs}
            settling={submitting}
            settleAll={settleAll}
            savedUrls={day.savedGofundmeUrls}
          />
        )}

        <p className="mt-8 text-center text-[11px] text-slate-400">
          You cannot navigate away.{" "}
          <Link href="/settings" className="underline">Settings</Link> is the only
          escape, and only to add GoFundMe URLs.
        </p>
      </div>

      {showBackdateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Mark as actually done?</h3>
            <p className="mt-1 text-sm text-slate-600">
              You're saying you did this yesterday but didn't check it off in
              time. This will be flagged as backdated. Are you being honest?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setShowBackdateWarning(null)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  setChoice(showBackdateWarning, { kind: "DONE", confirmed: true });
                  setShowBackdateWarning(null);
                }}
              >
                Yes, I did it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: "green" | "slate" | "red";
  icon: React.ReactNode;
  label: string;
}) {
  const palettes = {
    green: active ? "bg-green-600 text-white border-green-600" : "border-slate-300 text-slate-700 hover:border-green-600 hover:text-green-700",
    slate: active ? "bg-slate-700 text-white border-slate-700" : "border-slate-300 text-slate-700 hover:border-slate-500",
    red: active ? "bg-red-700 text-white border-red-700" : "border-slate-300 text-slate-700 hover:border-red-700 hover:text-red-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition",
        palettes[color]
      )}
    >
      {icon} {label}
    </button>
  );
}

function OwePicker({
  choice,
  urls,
  onChange,
}: {
  choice: Extract<Choice, { kind: "OWE" }>;
  urls: string[];
  onChange: (c: Extract<Choice, { kind: "OWE" }>) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <label className="mono text-[10px] uppercase text-slate-500">amount</label>
        <input
          type="number"
          min={5}
          max={100}
          step={5}
          className="mono w-20 rounded border border-slate-300 px-2 py-1 text-sm"
          value={choice.amountCents / 100}
          onChange={(e) =>
            onChange({
              ...choice,
              amountCents: Math.max(500, Math.min(10000, Math.round(Number(e.target.value) * 100))),
            })
          }
        />
        <span className="text-xs text-slate-500">$</span>
      </div>
      <div>
        <label className="mono text-[10px] uppercase text-slate-500">campaign</label>
        {urls.length === 0 ? (
          <p className="text-xs text-red-700">
            No saved GoFundMe URLs.{" "}
            <Link href="/settings" className="underline">Add one →</Link>
          </p>
        ) : (
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={choice.gofundmeUrl ?? ""}
            onChange={(e) => onChange({ ...choice, gofundmeUrl: e.target.value })}
          >
            {urls.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function SettleStep({
  openDebts,
  proofs,
  setProofs,
  settling,
  settleAll,
  savedUrls,
}: {
  openDebts: OpenDebt[];
  proofs: Record<string, string>;
  setProofs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  settling: boolean;
  settleAll: () => void;
  savedUrls: string[];
}) {
  // Note: openDebts is the *prior* snapshot from the server. New debts created
  // during resolve are fetched lazily inside settleAll. We display the prior
  // snapshot as a baseline; if you just created more, they'll be settled too.
  const totalCents = openDebts.reduce((s, d) => s + d.amountCents, 0);
  const allFilled = openDebts.every((d) => proofs[d.id]?.trim());
  return (
    <div className="space-y-4">
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3">
        <p className="font-semibold text-red-800">
          Settle your debt before continuing
        </p>
        <p className="text-sm text-red-700">
          Total outstanding: {formatCents(totalCents)} across {openDebts.length}{" "}
          debt(s). Paste a GoFundMe donation confirmation URL or receipt ID per debt.
        </p>
        {savedUrls.length > 0 && (
          <p className="mono mt-2 text-[11px] text-red-700">
            campaigns: {savedUrls.join(", ")}
          </p>
        )}
      </div>

      {openDebts.length === 0 ? (
        <p className="text-sm text-slate-600">
          No open debts from prior days. New debts you just created will be
          listed after refresh — click "Settle & continue" below to refresh and
          settle them all in one go.
        </p>
      ) : null}

      <ul className="space-y-2">
        {openDebts.map((d) => (
          <li
            key={d.id}
            className="rounded border border-slate-200 bg-white p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{d.taskTitle}</span>
              <span className="mono text-xs text-red-700">{d.amountLabel}</span>
            </div>
            <p className="mono text-[10px] text-slate-400">{d.dayLabel}</p>
            <input
              className="mono mt-2 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              placeholder="Donation confirmation URL or receipt ID"
              value={proofs[d.id] ?? ""}
              onChange={(e) =>
                setProofs((p) => ({ ...p, [d.id]: e.target.value }))
              }
            />
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <button
          className="rounded bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          disabled={(openDebts.length > 0 && !allFilled) || settling}
          onClick={settleAll}
        >
          Settle & continue
        </button>
      </div>
    </div>
  );
}
