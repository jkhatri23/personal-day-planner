import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const week = await prisma.week.findUnique({
      where: { id: params.id },
      include: {
        days: {
          include: { tasks: true, debt: true },
          orderBy: { date: "asc" },
        },
      },
    });
    if (!week) return bad("Not found", 404);

    const all = week.days.flatMap((d) => d.tasks);
    const counts = all.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const total = all.filter((t) => t.status !== "VOIDED").length;
    const completionPct = total === 0 ? 0 : Math.round((100 * (counts.DONE ?? 0)) / total);

    const owedDays = week.days.filter((d) => d.debt && !d.debt.settledAt);
    const settledDays = week.days.filter((d) => d.debt?.settledAt);
    const owedCents = owedDays.reduce((s, d) => s + (d.debt?.amountCents ?? 0), 0);
    const settledCents = settledDays.reduce((s, d) => s + (d.debt?.amountCents ?? 0), 0);

    const backdated = all.filter((t) => t.backdated).length;
    const rescheduled = [...all]
      .filter((t) => t.rescheduleCount > 0)
      .sort((a, b) => b.rescheduleCount - a.rescheduleCount)
      .slice(0, 5)
      .map((t) => ({ id: t.id, title: t.title, count: t.rescheduleCount }));

    return ok({
      weekId: week.id,
      intention: week.intention,
      startDate: week.startDate,
      counts,
      totalTracked: total,
      completionPct,
      owedDays: owedDays.length,
      owedCents,
      settledCents,
      voidsUsed: counts.VOIDED ?? 0,
      backdated,
      mostRescheduled: rescheduled,
      reckonedDays: week.days.filter((d) => d.reckonedAt).length,
    });
  } catch (e) {
    return handleError(e);
  }
}
