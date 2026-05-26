import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { rescheduleTaskSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { toDayId } = rescheduleTaskSchema.parse(await req.json());
    const t = await prisma.task.findUnique({ where: { id: params.id } });
    if (!t) return bad("Not found", 404);
    if (t.status !== "PLANNED") return bad("Only PLANNED tasks can be rescheduled", 409);
    if (t.rescheduleCount >= 1) {
      return bad("Already rescheduled once. Mark done, void, or owe.", 409);
    }
    const target = await prisma.day.findUnique({ where: { id: toDayId } });
    if (!target) return bad("Target day not found", 404);
    if (t.dayId === toDayId) return bad("Already on that day", 409);

    const max = await prisma.task.aggregate({
      where: { dayId: toDayId },
      _max: { position: true },
    });

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        dayId: toDayId,
        rescheduleCount: { increment: 1 },
        position: (max._max.position ?? -1) + 1,
      },
      include: { debt: true },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
