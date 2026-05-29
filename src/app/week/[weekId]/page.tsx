import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDayLabel } from "@/lib/dates";
import { WeekClient } from "./WeekClient";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WeekPage({ params }: { params: { weekId: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.weekId },
    include: {
      days: {
        orderBy: { date: "asc" },
        include: {
          debt: true,
          tasks: { orderBy: [{ startMinutes: "asc" }, { position: "asc" }] },
        },
      },
    },
  });
  if (!week) notFound();

  const all = week.days.flatMap((d) => d.tasks);
  const done = all.filter((t) => t.status === "DONE" || t.status === "SETTLED").length;
  const owedDays = week.days.filter((d) => d.debt && !d.debt.settledAt);
  const owedCents = owedDays.reduce((s, d) => s + (d.debt?.amountCents ?? 0), 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Week of {fmtDayLabel(week.startDate)}
          </h1>
          <Link
            href={`/week/${week.id}/review`}
            className="mono text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            review week →
          </Link>
        </div>
        <div className="flex items-center gap-4 mono text-sm">
          <span className="text-green-700">done: {done}</span>
          {owedDays.length > 0 && (
            <span className="text-red-700">
              owed days: {owedDays.length} ({formatCents(owedCents)})
            </span>
          )}
          <span className="text-slate-500">total: {all.length}</span>
        </div>
      </header>

      <WeekClient week={week} />
    </div>
  );
}
