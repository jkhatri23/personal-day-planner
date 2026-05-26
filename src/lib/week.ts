import { prisma, USER_ID } from "./db";
import { todayKey, weekStartForLocal, weekDays } from "./dates";

// Get-or-create the week containing `ref` plus its seven Day rows.
export async function ensureWeek(ref: Date = new Date()) {
  const start = weekStartForLocal(ref);
  let week = await prisma.week.findUnique({
    where: { userId_startDate: { userId: USER_ID, startDate: start } },
    include: { days: true },
  });
  if (!week) {
    week = await prisma.week.create({
      data: {
        userId: USER_ID,
        startDate: start,
        days: { create: weekDays(start).map((d) => ({ date: d })) },
      },
      include: { days: true },
    });
  } else if (week.days.length < 7) {
    const existing = new Set(week.days.map((d) => d.date.toISOString()));
    const missing = weekDays(start).filter(
      (d) => !existing.has(d.toISOString())
    );
    if (missing.length) {
      await prisma.day.createMany({
        data: missing.map((d) => ({ date: d, weekId: week!.id })),
      });
      week = await prisma.week.findUnique({
        where: { id: week.id },
        include: { days: true },
      });
    }
  }
  return week!;
}

// Returns the oldest Day with reckonedAt=null that is strictly before today.
export async function oldestUnreckonedPriorDay() {
  const today = todayKey();
  // Find any day before today that has tasks and isn't reckoned.
  const day = await prisma.day.findFirst({
    where: {
      date: { lt: today },
      reckonedAt: null,
      tasks: { some: {} },
      week: { userId: USER_ID },
    },
    orderBy: { date: "asc" },
  });
  return day;
}

export async function getTodayDay() {
  const today = todayKey();
  const week = await ensureWeek(new Date());
  const day =
    week.days.find((d) => d.date.getTime() === today.getTime()) ?? null;
  return { week, day };
}
