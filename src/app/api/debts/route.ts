import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status"); // OWED | SETTLED
    const where =
      status === "OWED"
        ? { settledAt: null }
        : status === "SETTLED"
        ? { settledAt: { not: null } }
        : {};
    const debts = await prisma.debt.findMany({
      where,
      include: {
        day: {
          include: {
            tasks: {
              where: { status: { in: ["OWED", "SETTLED"] } },
              select: { id: true, title: true, status: true },
            },
            week: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(debts);
  } catch (e) {
    return handleError(e);
  }
}
