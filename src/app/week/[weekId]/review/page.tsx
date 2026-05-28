import { notFound } from "next/navigation";
import { prisma, USER_ID } from "@/lib/db";
import { fmtDayLabel } from "@/lib/dates";
import { formatCents } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function computeStreak() {
  const days = await prisma.day.findMany({
    where: { week: { userId: USER_ID } },
    orderBy: { date: "desc" },
    include: { tasks: true },
  });
  let streak = 0;
  for (const d of days) {
    if (!d.reckonedAt) break;
    streak += 1;
  }
  return streak;
}

export default async function ReviewPage({ params }: { params: { weekId: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.weekId },
    include: {
      days: {
        orderBy: { date: "asc" },
        include: { tasks: true, debt: true },
      },
    },
  });
  if (!week) notFound();

  const all = week.days.flatMap((d) => d.tasks);
  const tracked = all.filter((t) => t.status !== "VOIDED");
  const done = all.filter((t) => t.status === "DONE" || t.status === "SETTLED").length;
  const voided = all.filter((t) => t.status === "VOIDED").length;
  const backdated = all.filter((t) => t.backdated).length;
  const reckonedDays = week.days.filter((d) => d.reckonedAt).length;
  const owedDays = week.days.filter((d) => d.debt && !d.debt.settledAt);
  const settledDays = week.days.filter((d) => d.debt?.settledAt);
  const cleanDays = week.days.filter((d) => d.reckonedAt && !d.debt);
  const owedCents = owedDays.reduce((s, d) => s + (d.debt?.amountCents ?? 0), 0);
  const settledCents = settledDays.reduce((s, d) => s + (d.debt?.amountCents ?? 0), 0);

  const rescheduled = [...all]
    .filter((t) => t.rescheduleCount > 0)
    .sort((a, b) => b.rescheduleCount - a.rescheduleCount)
    .slice(0, 5);

  const pct = tracked.length === 0 ? 0 : Math.round((100 * done) / tracked.length);
  const streak = await computeStreak();

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Week review · {fmtDayLabel(week.startDate)}
          </h1>
          {week.intention && (
            <p className="mt-1 text-sm italic text-slate-500">
              intention: {week.intention}
            </p>
          )}
        </div>
        <Link
          href={`/week/${week.id}`}
          className="mono text-xs text-slate-500 hover:underline"
        >
          ← back to week
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Task completion" value={`${pct}%`} sub={`${done}/${tracked.length} tracked`} />
        <StatCard label="Clean days" value={`${cleanDays.length}`} sub={`/${reckonedDays} reckoned`} tone="green" />
        <StatCard label="Owed" value={formatCents(owedCents)} sub={`${owedDays.length} day(s)`} tone="red" />
        <StatCard label="Streak" value={`${streak}d`} sub="reckoned in a row" />
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="mono text-xs uppercase text-slate-500">Honesty signals</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            voids used: <span className="mono">{voided}</span>
          </li>
          <li>
            tasks marked done after the fact: <span className="mono">{backdated}</span>
            {backdated > 3 && (
              <span className="ml-2 text-amber-700">
                ⚠ over the gentle warning threshold
              </span>
            )}
          </li>
          <li>
            days reckoned: <span className="mono">{reckonedDays}/7</span>
          </li>
          <li>
            settled this week: <span className="mono text-green-700">{formatCents(settledCents)}</span>
          </li>
        </ul>
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="mono text-xs uppercase text-slate-500">Most rescheduled</h2>
        {rescheduled.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {rescheduled.map((t) => (
              <li key={t.id} className="flex justify-between">
                <span>{t.title}</span>
                <span className="mono text-slate-500">×{t.rescheduleCount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="mono text-xs uppercase text-slate-500">Reflections</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {week.days
            .filter((d) => d.reflection)
            .map((d) => (
              <li key={d.id}>
                <p className="mono text-[10px] uppercase text-slate-400">
                  {fmtDayLabel(d.date)}
                </p>
                <p>{d.reflection}</p>
              </li>
            ))}
          {week.days.every((d) => !d.reflection) && (
            <li className="text-sm text-slate-500">
              No reflections logged this week.
            </li>
          )}
        </ul>
      </section>

      <section className="rounded border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold">Prompt for next week</p>
        <p className="mt-1 text-slate-600">
          {pct >= 80
            ? "Solid week. What did you protect that made this work?"
            : pct >= 50
              ? "Mixed week. Which task pattern slipped most?"
              : "Tough week. Pick one thing to do differently and write it in the intention for next week."}
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "red" | "green";
}) {
  const color =
    tone === "red"
      ? "text-red-700"
      : tone === "green"
        ? "text-green-700"
        : "text-slate-900";
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="mono text-[10px] uppercase text-slate-500">{label}</p>
      <p className={`mono mt-1 text-2xl ${color}`}>{value}</p>
      {sub && <p className="mono text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
