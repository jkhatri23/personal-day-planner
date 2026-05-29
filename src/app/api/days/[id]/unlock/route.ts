import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";

export const UNLOCK_BUDGET_PER_DAY = 1;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const day = await prisma.day.findUnique({ where: { id: params.id } });
    if (!day) return bad("Not found", 404);
    if (!day.lockedAt) return bad("Day isn't locked", 409);
    if (day.reckonedAt) return bad("Day already reckoned", 409);
    if (day.unlockCount >= UNLOCK_BUDGET_PER_DAY) {
      return bad(
        `You've used your one unlock for this day. Re-lock or reckon — no more edits.`,
        409
      );
    }
    const updated = await prisma.day.update({
      where: { id: day.id },
      data: { lockedAt: null, unlockCount: { increment: 1 } },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
