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
          tasks: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            include: { debt: true },
          },
        },
      },
    },
  });
  if (!week) notFound();

  const all = week.days.flatMap((d) => d.tasks);
  const done = all.filter((t) => t.status === "DONE" || t.status === "SETTLED").length;
  const owed = all.filter((t) => t.status === "OWED").length;
  const owedCents = all
    .filter((t) => t.debt && !t.debt.settledAt)
    .reduce((s, t) => s + (t.debt?.amountCents ?? 0), 0);

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
          {owed > 0 && (
            <span className="text-red-700">
              owed: {owed} ({formatCents(owedCents)})
            </span>
          )}
          <span className="text-slate-500">total: {all.length}</span>
        </div>
      </header>

      <WeekClient week={week} />
    </div>
  );
}
