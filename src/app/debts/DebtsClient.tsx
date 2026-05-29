"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { SettleDebtForm } from "@/components/SettleDebtForm";

type OwedDebt = {
  id: string;
  amountCents: number;
  amountLabel: string;
  dayLabel: string;
  gofundmeUrl: string | null;
  missedTaskCount: number;
};

type SettledDebt = {
  id: string;
  amountCents: number;
  amountLabel: string;
  dayLabel: string;
  gofundmeUrl: string | null;
  settledAt: Date | null;
  legacyProof: string | null;
  proofFileName: string | null;
  note: string | null;
  hasFile: boolean;
};

export function DebtsClient({
  owed,
  settled,
  savedGofundmeUrls,
}: {
  owed: OwedDebt[];
  settled: SettledDebt[];
  savedGofundmeUrls: string[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(owed[0]?.id ?? null);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 mono text-xs uppercase text-slate-500">Outstanding</h2>
        {owed.length === 0 ? (
          <p className="text-sm text-slate-500">None. Good.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded border border-slate-200">
            {owed.map((d) => {
              const isOpen = expanded === d.id;
              return (
                <li key={d.id}>
                  <button
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                  >
                    <div className="flex items-baseline gap-2">
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{d.dayLabel}</p>
                        <p className="mono text-[10px] text-slate-400">
                          {d.missedTaskCount} task
                          {d.missedTaskCount === 1 ? "" : "s"} missed
                          {d.gofundmeUrl ? ` · ${d.gofundmeUrl}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="mono text-sm text-red-700">
                      {d.amountLabel}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-3">
                      <ol className="mb-3 list-decimal pl-4 text-xs text-slate-600">
                        <li>
                          {d.gofundmeUrl ? (
                            <>
                              Donate {d.amountLabel} via{" "}
                              <a
                                href={d.gofundmeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-800 underline"
                              >
                                {d.gofundmeUrl}
                              </a>
                              .
                            </>
                          ) : (
                            <>Donate {d.amountLabel} via your saved campaign.</>
                          )}
                        </li>
                        <li>
                          Open the GoFundMe confirmation email and save it (Print →
                          Save as PDF, or right-click → save attachment as .eml).
                        </li>
                        <li>Upload that file below.</li>
                      </ol>
                      <SettleDebtForm
                        debtId={d.id}
                        amountLabel={d.amountLabel}
                        defaultGofundmeUrl={d.gofundmeUrl}
                        savedGofundmeUrls={savedGofundmeUrls}
                        onSettled={() => {
                          setExpanded(null);
                          router.refresh();
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
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
                  <span className="text-sm text-slate-700">{d.dayLabel}</span>
                  <span className="mono text-sm text-green-700">
                    settled {d.amountLabel}
                  </span>
                </div>
                {d.hasFile ? (
                  <a
                    href={`/api/debts/${d.id}/proof`}
                    className="mono mt-1 inline-flex items-center gap-1 text-[11px] text-slate-700 underline-offset-2 hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    {d.proofFileName ?? "download proof"}
                  </a>
                ) : d.legacyProof ? (
                  <p className="mono mt-1 text-[10px] text-slate-400">
                    proof: {d.legacyProof}
                  </p>
                ) : null}
                {d.note && (
                  <p className="mt-1 text-[11px] italic text-slate-500">
                    {d.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
