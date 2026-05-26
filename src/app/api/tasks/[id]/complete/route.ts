import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await prisma.task.findUnique({ where: { id: params.id } });
    if (!t) return bad("Not found", 404);
    if (t.status === "DONE" || t.status === "SETTLED") {
      // Toggle off: only allow toggling DONE back to PLANNED on same day
      if (t.status === "DONE") {
        const updated = await prisma.task.update({
          where: { id: params.id },
          data: { status: "PLANNED", completedAt: null, backdated: false },
          include: { debt: true },
        });
        return ok(updated);
      }
      return bad("Settled tasks can't be toggled", 409);
    }
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { status: "DONE", completedAt: new Date(), backdated: false },
      include: { debt: true },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
