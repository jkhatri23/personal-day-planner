import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, handleError } from "@/lib/api";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const debt = await prisma.debt.findUnique({ where: { id: params.id } });
    if (!debt) return bad("Not found", 404);
    if (!debt.donationProofPath) return bad("No proof file on this debt", 404);

    const buf = await readUpload(debt.donationProofPath);
    const filename = debt.donationProofName ?? "proof";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": debt.donationProofMime ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
