import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCents } from "@/lib/utils";
import { fmtDayLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const debts = await prisma.debt.findMany({
    include: { task: { include: { day: true } } },
    orderBy: { createdAt: "desc" },
  });
  const owed = debts.filter((d) => !d.settledAt);
  const settled = debts.filter((d) => d.settledAt);
  const owedTotal = owed.reduce((s, d) => s + d.amountCents, 0);
  const settledTotal = settled.reduce((s, d) => s + d.amountCents, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Debts</h1>
        <div className="mono text-sm">
          <span className="text-red-700">owed {formatCents(owedTotal)}</span>
          {" · "}
          <span className="text-green-700">settled {formatCents(settledTotal)}</span>
        </div>
      </header>

      <section>
        <h2 className="mb-2 mono text-xs uppercase text-slate-500">Outstanding</h2>
        {owed.length === 0 ? (
          <p className="text-sm text-slate-500">None. Good.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {owed.map((d) => (
              <li key={d.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">{d.task.title}</span>
                  <span className="mono text-sm text-red-700">
                    {formatCents(d.amountCents)}
                  </span>
                </div>
                <p className="mono text-[10px] text-slate-400">
                  {fmtDayLabel(d.task.day.date)}
                  {d.gofundmeUrl ? ` · ${d.gofundmeUrl}` : ""}
                </p>
                <p className="mt-1 text-xs text-red-700">
                  Settle through the next reckoning, or via Today view.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 mono text-xs uppercase text-slate-500">History</h2>
        {settled.length === 0 ? (
          <p className="text-sm text-slate-500">No settled debts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {settled.map((d) => (
              <li key={d.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-700">{d.task.title}</span>
                  <span className="mono text-sm text-green-700">
                    settled {formatCents(d.amountCents)}
                  </span>
                </div>
                <p className="mono text-[10px] text-slate-400">
                  {fmtDayLabel(d.task.day.date)} · proof: {d.donationProof}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        <Link href="/settings" className="underline">Manage campaigns →</Link>
      </p>
    </div>
  );
}
