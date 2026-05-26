import { PrismaClient } from "@prisma/client";
import { weekStartForLocal, weekDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const USER_ID = process.env.USER_ID ?? "jordan";

async function main() {
  const today = new Date();
  const start = weekStartForLocal(today);

  await prisma.settings.upsert({
    where: { userId: USER_ID },
    update: {},
    create: {
      userId: USER_ID,
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

  await prisma.task.createMany({
    data: [
      {
        title: "Morning workout",
        dayId: todayDay.id,
        priority: "MEDIUM",
        estimatedMins: 45,
        position: 0,
      },
      {
        title: "Plan the week (this app)",
        dayId: todayDay.id,
        priority: "HIGH",
        estimatedMins: 30,
        position: 1,
      },
      {
        title: "Review BeWell PRs",
        dayId: todayDay.id,
        priority: "HIGH",
        estimatedMins: 60,
        position: 2,
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
