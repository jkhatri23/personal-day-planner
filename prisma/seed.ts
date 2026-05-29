import { PrismaClient } from "@prisma/client";
import { weekStartForLocal, weekDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const USER_ID = process.env.USER_ID ?? "jordan";

async function main() {
  const today = new Date();
  const start = weekStartForLocal(today);

  await prisma.settings.upsert({
    where: { userId: USER_ID },
    update: { defaultAmountCents: 700 },
    create: {
      userId: USER_ID,
      defaultAmountCents: 700,
      gofundmeUrlsJson: JSON.stringify([
        "https://www.gofundme.com/c/act/disaster-relief",
      ]),
    },
  });

  const existing = await prisma.week.findUnique({
    where: { userId_startDate: { userId: USER_ID, startDate: start } },
  });
  if (existing) {
    console.log("Week already seeded:", existing.id);
    return;
  }

  const week = await prisma.week.create({
    data: {
      userId: USER_ID,
      startDate: start,
      intention: "Ship the planner; close the BeWell punch list.",
      days: { create: weekDays(start).map((d) => ({ date: d })) },
    },
    include: { days: true },
  });

  const todayKey = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const todayDay = week.days.find((d) => d.date.getTime() === todayKey.getTime())!;

  // Demo schedule, all timed. Times are minutes from local midnight.
  await prisma.task.createMany({
    data: [
      {
        title: "Morning workout",
        dayId: todayDay.id,
        priority: "MEDIUM",
        startMinutes: 7 * 60,
        endMinutes: 8 * 60,
        position: 0,
      },
      {
        title: "Deep work: planner UI",
        dayId: todayDay.id,
        priority: "HIGH",
        startMinutes: 9 * 60,
        endMinutes: 11 * 60,
        position: 1,
      },
      {
        title: "Review BeWell PRs",
        dayId: todayDay.id,
        priority: "HIGH",
        startMinutes: 13 * 60,
        endMinutes: 14 * 60 + 30,
        position: 2,
      },
      {
        title: "Read 30 pages",
        dayId: todayDay.id,
        priority: "LOW",
        startMinutes: 20 * 60,
        endMinutes: 20 * 60 + 30,
        position: 3,
      },
    ],
  });

  console.log("Seeded week", week.id, "with", week.days.length, "days");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
