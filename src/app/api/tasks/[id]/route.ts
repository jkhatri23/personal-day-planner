import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { updateTaskSchema } from "@/lib/schemas";
import { todayKey } from "@/lib/dates";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = updateTaskSchema.parse(await req.json());
    const existing = await prisma.task.findUnique({
      where: { id: params.id },
      include: { day: true },
    });
    if (!existing) return bad("Not found", 404);
    if (existing.day.lockedAt) return bad("Day is locked — cannot edit tasks", 409);

    // Combined time validation: both must end up either set or null, and
    // span ≥ 15 min.
    const nextStart =
      body.startMinutes === undefined ? existing.startMinutes : body.startMinutes;
    const nextEnd =
      body.endMinutes === undefined ? existing.endMinutes : body.endMinutes;
    if ((nextStart == null) !== (nextEnd == null))
      return bad("Provide both start and end (or neither)", 422);
    if (nextStart != null && nextEnd != null && nextEnd - nextStart < 15)
      return bad("End must be at least 15 minutes after start", 422);

    if (body.priority === "HIGH" && existing.priority !== "HIGH") {
      const highCount = await prisma.task.count({
        where: {
          dayId: existing.dayId,
          priority: "HIGH",
          status: { not: "VOIDED" },
          id: { not: existing.id },
        },
      });
      if (highCount >= 3) {
        return bad("Max 3 HIGH priority tasks per day.", 409);
      }
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: body,
    });
    return ok(task);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await prisma.task.findUnique({
      where: { id: params.id },
      include: { day: true },
    });
    if (!t) return bad("Not found", 404);
    if (t.day.lockedAt) return bad("Day is locked — cannot delete tasks", 409);
    if (t.status !== "PLANNED") return bad("Can only delete PLANNED tasks", 409);
    const today = todayKey();
    if (t.day.date.getTime() !== today.getTime()) {
      return bad("Can only delete same-day tasks", 409);
    }
    await prisma.task.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
