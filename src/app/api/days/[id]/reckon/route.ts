import { NextRequest } from "next/server";
import { prisma, USER_ID } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { reckonSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = reckonSchema.parse(await req.json());
    const day = await prisma.day.findUnique({
      where: { id: params.id },
      include: {
        tasks: { include: { debt: true } },
        week: true,
      },
    });
    if (!day) return bad("Day not found", 404);
    if (day.reckonedAt) return bad("Already reckoned", 409);

    const settings = await getSettings();
    const planned = day.tasks.filter((t) => t.status === "PLANNED");
    const plannedIds = new Set(planned.map((t) => t.id));
    const resIds = new Set(body.resolutions.map((r) => r.taskId));
    for (const id of plannedIds) {
      if (!resIds.has(id)) return bad(`Missing resolution for task ${id}`, 422);
    }
    for (const r of body.resolutions) {
      if (!plannedIds.has(r.taskId))
        return bad(`Task ${r.taskId} is not a PLANNED task on this day`, 422);
    }

    // void budget check across the week
    const newVoids = body.resolutions.filter((r) => r.kind === "VOID").length;
    if (newVoids > 0) {
      const used = await prisma.task.count({
        where: {
          status: "VOIDED",
          day: {
            week: { userId: USER_ID, startDate: day.week.startDate },
            id: { not: day.id },
          },
        },
      });
      if (used + newVoids > settings.weeklyVoidBudget) {
        return bad(
          `Void budget exceeded (${settings.weeklyVoidBudget}/week). Mark done or owe instead.`,
          409
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const r of body.resolutions) {
        if (r.kind === "DONE") {
          await tx.task.update({
            where: { id: r.taskId },
            data: { status: "DONE", completedAt: new Date(), backdated: true },
          });
        } else if (r.kind === "VOID") {
          await tx.task.update({
            where: { id: r.taskId },
            data: { status: "VOIDED", voidReason: r.reason },
          });
        } else {
          await tx.task.update({
            where: { id: r.taskId },
            data: { status: "OWED" },
          });
          await tx.debt.upsert({
            where: { taskId: r.taskId },
            update: {
              amountCents: r.amountCents,
              gofundmeUrl: r.gofundmeUrl ?? null,
            },
            create: {
              taskId: r.taskId,
              amountCents: r.amountCents,
              gofundmeUrl: r.gofundmeUrl ?? null,
            },
          });
        }
      }
      const updated = await tx.day.update({
        where: { id: day.id },
        data: { reckonedAt: new Date(), reflection: body.reflection ?? null },
        include: { tasks: { include: { debt: true } } },
      });
      return updated;
    });

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
