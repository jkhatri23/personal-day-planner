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
    include: {
      tasks: { include: { debt: true } },
      week: true,
    },
  });
  if (!day) notFound();
  if (day.reckonedAt) redirect("/today");

  const planned = day.tasks.filter((t) => t.status === "PLANNED");
  // No planned tasks → still close the day so the gate releases.
  const settings = await getSettings();

  // How many voids already used this week (other days).
  const voidsUsed = await prisma.task.count({
    where: {
      status: "VOIDED",
      day: {
        week: { startDate: day.week.startDate },
        id: { not: day.id },
      },
    },
  });

  // Outstanding debts from prior days that must be settled before "continue".
  const openDebts = await prisma.debt.findMany({
    where: {
      settledAt: null,
      task: {
        day: {
          date: { lte: day.date },
          week: { startDate: day.week.startDate },
        },
      },
    },
    include: { task: { include: { day: true } } },
  });

  return (
    <ReckonClient
      day={{
        id: day.id,
        date: day.date,
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
        taskTitle: d.task.title,
        dayLabel: fmtDayLabel(d.task.day.date),
      }))}
    />
  );
}
