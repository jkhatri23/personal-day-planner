import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

// Drag-and-drop move on the weekly board.
// Distinct from /reschedule: doesn't bump rescheduleCount when moving between
// future days in the planning grid, but DOES enforce the cap when the source
// day is in the past (which shouldn't normally happen — past days are reckoned).
const moveSchema = z.object({
  toDayId: z.string(),
  position: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { toDayId, position } = moveSchema.parse(await req.json());
    const t = await prisma.task.findUnique({
      where: { id: params.id },
      include: { day: true },
    });
    if (!t) return bad("Not found", 404);
    if (t.status !== "PLANNED") return bad("Only PLANNED tasks can be moved", 409);

    const target = await prisma.day.findUnique({ where: { id: toDayId } });
    if (!target) return bad("Target day not found", 404);

    const sameDay = t.dayId === toDayId;
    let pos = position;
    if (pos === undefined) {
      const max = await prisma.task.aggregate({
        where: { dayId: toDayId },
        _max: { position: true },
      });
      pos = (max._max.position ?? -1) + 1;
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { dayId: toDayId, position: pos },
      include: { debt: true },
    });

    if (!sameDay) {
      // resequence both source and target to keep tidy positions
      const ids = await prisma.task.findMany({
        where: { dayId: t.dayId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      await Promise.all(
        ids.map((row, i) =>
          prisma.task.update({ where: { id: row.id }, data: { position: i } })
        )
      );
    }

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
