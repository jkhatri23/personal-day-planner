import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, bad, handleError } from "@/lib/api";
import { settleDebtMetaSchema } from "@/lib/schemas";
import { saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return bad("Upload your GoFundMe confirmation email or receipt as a file.", 422);
    }
    const meta = settleDebtMetaSchema.parse({
      note: (form.get("note") as string | null)?.trim() || undefined,
      gofundmeUrl: (form.get("gofundmeUrl") as string | null) || undefined,
    });

    const debt = await prisma.debt.findUnique({
      where: { id: params.id },
      include: { day: true },
    });
    if (!debt) return bad("Not found", 404);
    if (debt.settledAt) return bad("Already settled", 409);

    const saved = await saveUpload(debt.id, file);

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: {
          donationProofPath: saved.relativePath,
          donationProofName: saved.name,
          donationProofMime: saved.mime,
          donationProofSize: saved.size,
          donationProofNote: meta.note ?? null,
          gofundmeUrl: meta.gofundmeUrl ?? debt.gofundmeUrl,
          settledAt: new Date(),
        },
      });
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
