import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ReckonClient } from "./ReckonClient";
import { getSettings } from "@/lib/settings";
import { fmtDayLabel } from "@/lib/dates";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReckonPage({ params }: { params: { dayId: string } }) {
  const day = await prisma.day.findUnique({
    where: { id: params.dayId },
    include: { tasks: true, week: true, debt: true },
  });
  if (!day) notFound();
  if (day.reckonedAt) redirect("/today");

  const planned = day.tasks.filter((t) => t.status === "PLANNED");
  const settings = await getSettings();

  const voidsUsed = await prisma.task.count({
    where: {
      status: "VOIDED",
      day: { week: { startDate: day.week.startDate }, id: { not: day.id } },
    },
  });

  const openDebts = await prisma.debt.findMany({
    where: {
      settledAt: null,
      day: {
        date: { lte: day.date },
        week: { startDate: day.week.startDate },
      },
    },
    include: { day: { include: { tasks: { where: { status: "OWED" } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <ReckonClient
      day={{
        id: day.id,
        dateLabel: fmtDayLabel(day.date),
        planned,
        voidsUsedThisWeek: voidsUsed,
        weeklyVoidBudget: settings.weeklyVoidBudget,
        defaultAmountCents: settings.defaultAmountCents,
        defaultAmountLabel: formatCents(settings.defaultAmountCents),
        savedGofundmeUrls: settings.gofundmeUrls,
      }}
      openDebts={openDebts.map((d) => ({
        id: d.id,
        amountCents: d.amountCents,
        amountLabel: formatCents(d.amountCents),
        gofundmeUrl: d.gofundmeUrl,
        dayLabel: fmtDayLabel(d.day.date),
        owedTaskTitles: d.day.tasks.map((t) => t.title),
      }))}
    />
  );
}
