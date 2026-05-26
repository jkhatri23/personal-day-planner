import Link from "next/link";
import { ensureWeek } from "@/lib/week";

export async function NavBar() {
  const week = await ensureWeek();
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/today"
            className="rounded px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-100"
          >
            Today
          </Link>
          <Link
            href={`/week/${week.id}`}
            className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Week
          </Link>
          <Link
            href={`/week/${week.id}/review`}
            className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Review
          </Link>
          <Link
            href="/debts"
            className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Debts
          </Link>
          <Link
            href="/settings"
            className="rounded px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            Settings
          </Link>
        </div>
        <span className="mono text-xs text-slate-400">accountability planner</span>
      </div>
    </nav>
  );
}
