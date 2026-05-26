import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, bad } from "@/lib/api";
import { updateWeekSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = updateWeekSchema.parse(await req.json());
    const wk = await prisma.week.update({
      where: { id: params.id },
      data: body,
    });
    return ok(wk);
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const wk = await prisma.week.findUnique({
      where: { id: params.id },
      include: {
        days: {
          orderBy: { date: "asc" },
          include: { tasks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { debt: true } } },
        },
      },
    });
    if (!wk) return bad("Not found", 404);
    return ok(wk);
  } catch (e) {
    return handleError(e);
  }
}
