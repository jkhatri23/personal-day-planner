import { NextRequest } from "next/server";
import { prisma, USER_ID } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { voidTaskSchema } from "@/lib/schemas";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { reason } = voidTaskSchema.parse(await req.json());
    const t = await prisma.task.findUnique({
      where: { id: params.id },
      include: { day: { include: { week: true } } },
    });
    if (!t) return bad("Not found", 404);
    if (t.day.lockedAt) {
      return bad(
        "Day is locked — void via the reckoning at end-of-day instead",
        409
      );
    }
    if (t.status === "OWED" || t.status === "SETTLED") {
      return bad("Cannot void after debt is created", 409);
    }

    const settings = await getSettings();
    const used = await prisma.task.count({
      where: {
        status: "VOIDED",
        day: { week: { userId: USER_ID, startDate: t.day.week.startDate } },
      },
    });
    if (used >= settings.weeklyVoidBudget) {
      return bad(
        `Weekly void budget (${settings.weeklyVoidBudget}) used. Mark done or owe instead.`,
        409
      );
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: { status: "VOIDED", voidReason: reason },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
