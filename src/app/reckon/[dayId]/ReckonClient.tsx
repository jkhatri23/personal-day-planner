"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, DollarSign, AlertTriangle } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import { SettleDebtForm } from "@/components/SettleDebtForm";
import { formatTimeLabel } from "@/lib/calendar";

type PlannedTask = {
  id: string;
  title: string;
  notes: string | null;
  priority: string;
  estimatedMins: number | null;
  startMinutes: number | null;
  endMinutes: number | null;
  rescheduleCount: number;
};

type Choice =
  | { kind: "DONE" }
  | { kind: "VOID"; reason: string }
  | { kind: "OWE" }
  | { kind: null };

type DayInfo = {
  id: string;
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
  dayLabel: string;
  owedTaskTitles: string[];
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
  const [gofundmeUrl, setGofundmeUrl] = useState<string>(
    day.savedGofundmeUrls[0] ?? ""
  );
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"resolve" | "settle">("resolve");
  const [backdateWarn, setBackdateWarn] = useState<string | null>(null);
  const [debtsToSettle, setDebtsToSettle] = useState<OpenDebt[]>(openDebts);
  const [settled, setSettled] = useState<Set<string>>(new Set());

  const allResolved = day.planned.every((t) => choices[t.id]?.kind !== null);
  const voidCount = Object.values(choices).filter((c) => c.kind === "VOID").length;
  const oweCount = Object.values(choices).filter((c) => c.kind === "OWE").length;
  const voidsRemaining = day.weeklyVoidBudget - day.voidsUsedThisWeek;
  const overVoidBudget = voidCount > voidsRemaining;
  const backdateCount = Object.values(choices).filter((c) => c.kind === "DONE").length;
  const willOwe = oweCount > 0;

  function setChoice(taskId: string, c: Choice) {
    setChoices((prev) => ({ ...prev, [taskId]: c }));
  }

  async function submitResolutions() {
    if (!allResolved) return setErr("Resolve every task before continuing.");
    if (overVoidBudget) {
      return setErr(
        `You're trying to void ${voidCount} but only ${Math.max(
          voidsRemaining,
          0
        )} remain this week.`
      );
    }
    for (const t of day.planned) {
      const c = choices[t.id];
      if (c.kind === "VOID" && c.reason.trim().length < 10) {
        return setErr(`"${t.title}" needs a void reason of at least 10 characters.`);
      }
    }
    if (willOwe && !gofundmeUrl) {
      return setErr("Pick a GoFundMe campaign — you'll owe for this day.");
    }

    setSubmitting(true);
    setErr(null);
    try {
      const resolutions = day.planned.map((t) => {
        const c = choices[t.id];
        if (c.kind === "DONE") return { kind: "DONE" as const, taskId: t.id };
        if (c.kind === "VOID")
          return { kind: "VOID" as const, taskId: t.id, reason: c.reason.trim() };
        return { kind: "OWE" as const, taskId: t.id };
      });

      const res = await fetch(`/api/days/${day.id}/reckon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutions,
          reflection: reflection.trim() || null,
          gofundmeUrl: willOwe ? gofundmeUrl : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();

      const fresh = await fetch("/api/debts?status=OWED").then((r) => r.json());
      const list: OpenDebt[] = fresh.map((d: any) => ({
        id: d.id,
        amountCents: d.amountCents,
        amountLabel: formatCents(d.amountCents),
        gofundmeUrl: d.gofundmeUrl,
        dayLabel: new Date(d.day.date).toDateString(),
        owedTaskTitles: d.day.tasks
          .filter((t: { status: string }) => t.status === "OWED")
          .map((t: { title: string }) => t.title),
      }));
      setDebtsToSettle(list);

      if (list.length === 0) {
        router.replace("/today");
      } else {
        setStep("settle");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

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
      if (debtsToSettle.length > 0) {
        setStep("settle");
      } else {
        router.replace("/today");
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function onOneSettled(debtId: string) {
    const next = new Set(settled);
    next.add(debtId);
    setSettled(next);
    router.refresh();
    if (next.size >= debtsToSettle.length) {
      // Brief delay so user sees the green state before navigation.
      setTimeout(() => {
        router.replace("/today");
        router.refresh();
      }, 400);
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
            One rule: if <em>any</em> task ends up owed, you donate{" "}
            <span className="font-semibold">{day.defaultAmountLabel}</span> for
            the whole day. Finish them all and the day costs you nothing.
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
                <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 mono text-xs text-slate-500">
                  <span>
                    void budget: {Math.max(voidsRemaining, 0)} remaining
                    {overVoidBudget && (
                      <span className="ml-2 text-red-700">
                        ({voidCount} planned, over budget)
                      </span>
                    )}
                  </span>
                  <span className={cn(willOwe ? "text-red-700" : "text-slate-500")}>
                    day cost: {willOwe ? day.defaultAmountLabel : "$0.00"}
                  </span>
                </div>

                <ul className="space-y-3">
                  {day.planned.map((t) => (
                    <li key={t.id} className="rounded border border-slate-200 bg-white p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.title}</p>
                          {t.notes && (
                            <p className="text-xs text-slate-500">{t.notes}</p>
                          )}
                          <p className="mono mt-0.5 text-[10px] uppercase text-slate-400">
                            {t.startMinutes != null && t.endMinutes != null
                              ? `${formatTimeLabel(t.startMinutes)}–${formatTimeLabel(t.endMinutes)} · `
                              : ""}
                            {t.priority}
                            {t.rescheduleCount > 0 ? " · rescheduled" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ChoiceButton
                          active={choices[t.id]?.kind === "DONE"}
                          onClick={() => {
                            if (choices[t.id]?.kind !== "DONE") {
                              setBackdateWarn(t.id);
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
                            setChoice(
                              t.id,
                              choices[t.id]?.kind === "VOID"
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
                            setChoice(
                              t.id,
                              choices[t.id]?.kind === "OWE"
                                ? { kind: null }
                                : { kind: "OWE" }
                            )
                          }
                          color="red"
                          icon={<DollarSign className="h-4 w-4" />}
                          label="Didn't do it"
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
                    </li>
                  ))}
                </ul>

                {willOwe && (
                  <div className="mt-4 rounded border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-800">
                      You missed {oweCount} task{oweCount === 1 ? "" : "s"}. You'll
                      owe a flat{" "}
                      <span className="font-semibold">{day.defaultAmountLabel}</span>{" "}
                      for this day. (GoFundMe charges in USD; that's the equivalent
                      of about $10 CAD.)
                    </p>
                    <label className="mt-2 block">
                      <span className="mono text-[10px] uppercase text-red-700">
                        campaign
                      </span>
                      {day.savedGofundmeUrls.length === 0 ? (
                        <p className="text-xs text-red-700">
                          No saved GoFundMe URLs.{" "}
                          <Link href="/settings" className="underline">
                            Add one →
                          </Link>
                        </p>
                      ) : (
                        <select
                          className="mt-1 w-full rounded border border-red-300 bg-white px-2 py-1 text-sm"
                          value={gofundmeUrl}
                          onChange={(e) => setGofundmeUrl(e.target.value)}
                        >
                          {day.savedGofundmeUrls.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>
                )}

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
                    Backdating {backdateCount} tasks. Flagged on the weekly review.
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={
                      !allResolved ||
                      overVoidBudget ||
                      submitting ||
                      (willOwe && !gofundmeUrl)
                    }
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
            debts={debtsToSettle}
            settled={settled}
            savedUrls={day.savedGofundmeUrls}
            onSettled={onOneSettled}
          />
        )}

        <p className="mt-8 text-center text-[11px] text-slate-400">
          Navigation is locked until this day is resolved.{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          is the only escape, and only to add GoFundMe URLs.
        </p>
      </div>

      {backdateWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Mark as actually done?</h3>
            <p className="mt-1 text-sm text-slate-600">
              You're saying you did this but didn't check it off in time. This
              will be flagged as backdated. Are you being honest?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setBackdateWarn(null)}
              >
                Cancel
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  setChoice(backdateWarn, { kind: "DONE" });
                  setBackdateWarn(null);
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
    green: active
      ? "bg-green-600 text-white border-green-600"
      : "border-slate-300 text-slate-700 hover:border-green-600 hover:text-green-700",
    slate: active
      ? "bg-slate-700 text-white border-slate-700"
      : "border-slate-300 text-slate-700 hover:border-slate-500",
    red: active
      ? "bg-red-700 text-white border-red-700"
      : "border-slate-300 text-slate-700 hover:border-red-700 hover:text-red-700",
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

function SettleStep({
  debts,
  settled,
  savedUrls,
  onSettled,
}: {
  debts: OpenDebt[];
  settled: Set<string>;
  savedUrls: string[];
  onSettled: (debtId: string) => void;
}) {
  const totalCents = debts.reduce((s, d) => s + d.amountCents, 0);
  const remaining = debts.filter((d) => !settled.has(d.id));
  return (
    <div className="space-y-4">
      <div className="rounded border border-red-200 bg-red-50 px-4 py-3">
        <p className="font-semibold text-red-800">
          Settle your debt before continuing
        </p>
        <p className="text-sm text-red-700">
          Total outstanding: {formatCents(totalCents)} across {debts.length}{" "}
          day{debts.length === 1 ? "" : "s"}.{" "}
          {remaining.length > 0
            ? `${remaining.length} left to settle.`
            : "All settled — redirecting…"}
        </p>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
        <li>Open the GoFundMe campaign linked below and donate the listed amount.</li>
        <li>Save the confirmation email GoFundMe sends you (Print → Save as PDF, export .eml, or screenshot).</li>
        <li>Upload the file in the form for each day below. The debt clears once the file is attached.</li>
      </ol>

      <ul className="space-y-3">
        {debts.map((d) => {
          const isSettled = settled.has(d.id);
          return (
            <li
              key={d.id}
              className={cn(
                "rounded border p-3",
                isSettled ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{d.dayLabel}</p>
                  <p className="mono text-[10px] text-slate-400">
                    {d.owedTaskTitles.length} task
                    {d.owedTaskTitles.length === 1 ? "" : "s"} missed:{" "}
                    {d.owedTaskTitles.slice(0, 3).join(", ")}
                    {d.owedTaskTitles.length > 3
                      ? `, +${d.owedTaskTitles.length - 3} more`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "mono text-xs",
                    isSettled ? "text-green-700" : "text-red-700"
                  )}
                >
                  {isSettled ? "✓ settled" : d.amountLabel}
                </span>
              </div>
              {d.gofundmeUrl && (
                <p className="mono mt-1 text-[10px]">
                  →{" "}
                  <a
                    href={d.gofundmeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {d.gofundmeUrl}
                  </a>
                </p>
              )}

              {!isSettled && (
                <div className="mt-3">
                  <SettleDebtForm
                    debtId={d.id}
                    amountLabel={d.amountLabel}
                    defaultGofundmeUrl={d.gofundmeUrl}
                    savedGofundmeUrls={savedUrls}
                    onSettled={() => onSettled(d.id)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
