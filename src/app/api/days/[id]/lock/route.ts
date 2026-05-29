import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const day = await prisma.day.findUnique({
      where: { id: params.id },
      include: { tasks: true },
    });
    if (!day) return bad("Not found", 404);
    if (day.lockedAt) return bad("Already locked", 409);
    if (day.reckonedAt) return bad("Day already reckoned", 409);
    const planned = day.tasks.filter((t) => t.status !== "VOIDED");
    if (planned.length === 0) {
      return bad("Add at least one task before locking the schedule", 422);
    }
    const unscheduled = planned.filter(
      (t) => t.startMinutes == null || t.endMinutes == null
    );
    if (unscheduled.length > 0) {
      return bad(
        `Schedule every task before locking (${unscheduled.length} still unscheduled)`,
        422
      );
    }
    const updated = await prisma.day.update({
      where: { id: day.id },
      data: { lockedAt: new Date() },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
