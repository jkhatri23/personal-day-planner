import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { settleDebtSchema } from "@/lib/schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = settleDebtSchema.parse(await req.json());
    const debt = await prisma.debt.findUnique({
      where: { id: params.id },
      include: { day: true },
    });
    if (!debt) return bad("Not found", 404);
    if (debt.settledAt) return bad("Already settled", 409);

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: {
          donationProof: body.donationProof,
          gofundmeUrl: body.gofundmeUrl ?? debt.gofundmeUrl,
          settledAt: new Date(),
        },
      });
      // Flip every OWED task on the day to SETTLED — one donation clears the
      // whole day, not just one task.
      await tx.task.updateMany({
        where: { dayId: debt.dayId, status: "OWED" },
        data: { status: "SETTLED" },
      });
      return d;
    });

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
