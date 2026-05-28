import { ensureWeek } from "@/lib/week";
import { ok, handleError } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const week = await ensureWeek();
    const full = await prisma.week.findUnique({
      where: { id: week.id },
      include: {
        days: {
          orderBy: { date: "asc" },
          include: {
            debt: true,
            tasks: {
              orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });
    return ok(full);
  } catch (e) {
    return handleError(e);
  }
}
