import { getTodayDay } from "@/lib/week";
import { prisma } from "@/lib/db";
import { fmtDayLabel, todayKey } from "@/lib/dates";
import { TodayClient } from "./TodayClient";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { week, day } = await getTodayDay();
  if (!day) return null;
  const today = todayKey();

  const fresh = await prisma.day.findUnique({
    where: { id: day.id },
    include: {
      tasks: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { debt: true },
      },
    },
  });

  // Yesterday's stats for the carry-forward digest
  const prev = await prisma.day.findFirst({
    where: { date: { lt: today }, week: { userId: week.userId } },
    orderBy: { date: "desc" },
    include: { tasks: { include: { debt: true } } },
  });

  const prevSummary = prev
    ? (() => {
        const tracked = prev.tasks.filter((t) => t.status !== "VOIDED");
        const done = tracked.filter((t) => t.status === "DONE" || t.status === "SETTLED").length;
        const owed = prev.tasks
          .filter((t) => t.debt && !t.debt.settledAt)
          .reduce((s, t) => s + (t.debt?.amountCents ?? 0), 0);
        return {
          date: prev.date,
          done,
          total: tracked.length,
          owedLabel: formatCents(owed),
        };
      })()
    : null;

  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fmtDayLabel(today)}</h1>
          <p className="text-sm text-slate-500">
            {fresh?.tasks.length ?? 0} tasks planned · week starting{" "}
            <span className="mono">{fmtDayLabel(week.startDate)}</span>
          </p>
        </div>
        {prevSummary && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Yesterday
            </p>
            <p className="mono text-sm text-slate-800">
              {prevSummary.done}/{prevSummary.total} done · owe {prevSummary.owedLabel}
            </p>
          </div>
        )}
      </header>

      <TodayClient
        initialTasks={fresh?.tasks ?? []}
        dayId={day.id}
        weekId={week.id}
        settings={settings}
      />
    </div>
  );
}
