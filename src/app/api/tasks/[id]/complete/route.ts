import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const t = await prisma.task.findUnique({ where: { id: params.id } });
    if (!t) return bad("Not found", 404);
    if (t.status === "DONE") {
      const updated = await prisma.task.update({
        where: { id: params.id },
        data: { status: "PLANNED", completedAt: null, backdated: false },
      });
      return ok(updated);
    }
    if (t.status === "SETTLED") {
      return bad("Settled tasks can't be toggled", 409);
    }
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { status: "DONE", completedAt: new Date(), backdated: false },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
