import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { createTaskSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = createTaskSchema.parse(await req.json());
    const day = await prisma.day.findUnique({ where: { id: body.dayId } });
    if (!day) return bad("Day not found", 404);

    if (body.priority === "HIGH") {
      const highCount = await prisma.task.count({
        where: { dayId: body.dayId, priority: "HIGH", status: { not: "VOIDED" } },
      });
      if (highCount >= 3) {
        return bad("Max 3 HIGH priority tasks per day. Lower another first.", 409);
      }
    }

    const max = await prisma.task.aggregate({
      where: { dayId: body.dayId },
      _max: { position: true },
    });
    const task = await prisma.task.create({
      data: {
        title: body.title,
        notes: body.notes ?? null,
        dayId: body.dayId,
        priority: body.priority,
        estimatedMins: body.estimatedMins ?? null,
        position: (max._max.position ?? -1) + 1,
      },
    });
    return ok(task, 201);
  } catch (e) {
    return handleError(e);
  }
}
