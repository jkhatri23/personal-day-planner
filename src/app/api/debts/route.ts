import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status"); // OWED | SETTLED | null
    const where = status
      ? { task: { status: status } }
      : {};
    const debts = await prisma.debt.findMany({
      where,
      include: { task: { include: { day: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok(debts);
  } catch (e) {
    return handleError(e);
  }
}
