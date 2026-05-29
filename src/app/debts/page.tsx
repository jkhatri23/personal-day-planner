import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { fmtDayLabel } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { DebtsClient } from "./DebtsClient";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const [debts, settings] = await Promise.all([
    prisma.debt.findMany({
      include: {
        day: {
          include: {
            tasks: { where: { status: { in: ["OWED", "SETTLED"] } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);

  const owed = debts.filter((d) => !d.settledAt);
  const settled = debts.filter((d) => d.settledAt);
  const owedTotal = owed.reduce((s, d) => s + d.amountCents, 0);
  const settledTotal = settled.reduce((s, d) => s + d.amountCents, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Debts</h1>
        <div className="mono text-sm">
          <span className="text-red-700">owed {formatCents(owedTotal)}</span>{" · "}
          <span className="text-green-700">settled {formatCents(settledTotal)}</span>
        </div>
      </header>

      <p className="text-xs text-slate-500">
        One debt per day at {formatCents(settings.defaultAmountCents)} (USD on
        GoFundMe ≈ $10 CAD). Owed if any task ends up un-done at end-of-day.
        Settle by uploading the GoFundMe confirmation email or receipt.
      </p>

      <DebtsClient
        owed={owed.map((d) => ({
          id: d.id,
          amountCents: d.amountCents,
          amountLabel: formatCents(d.amountCents),
          dayLabel: fmtDayLabel(d.day.date),
          gofundmeUrl: d.gofundmeUrl,
          missedTaskCount: d.day.tasks.length,
        }))}
        settled={settled.map((d) => ({
          id: d.id,
          amountCents: d.amountCents,
          amountLabel: formatCents(d.amountCents),
          dayLabel: fmtDayLabel(d.day.date),
          gofundmeUrl: d.gofundmeUrl,
          settledAt: d.settledAt,
          // Legacy text proof (URL/receipt id) vs new file proof.
          legacyProof: d.donationProofPath ? null : d.donationProof,
          proofFileName: d.donationProofName,
          note: d.donationProofNote,
          hasFile: Boolean(d.donationProofPath),
        }))}
        savedGofundmeUrls={settings.gofundmeUrls}
      />

      <p className="text-xs text-slate-400">
        <Link href="/settings" className="underline">
          Manage campaigns →
        </Link>
      </p>
    </div>
  );
}
