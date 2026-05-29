"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettleDebtForm({
  debtId,
  amountLabel,
  defaultGofundmeUrl,
  savedGofundmeUrls,
  onSettled,
  dense = false,
}: {
  debtId: string;
  amountLabel: string;
  defaultGofundmeUrl: string | null;
  savedGofundmeUrls?: string[];
  onSettled: () => void;
  dense?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState(defaultGofundmeUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    if (!file) return setErr("Attach the GoFundMe confirmation file first.");
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (note.trim()) form.append("note", note.trim());
      if (url) form.append("gofundmeUrl", url);
      const res = await fetch(`/api/debts/${debtId}/settle`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      onSettled();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", dense ? "" : "space-y-3")}>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded border border-dashed px-3 py-2 text-xs",
          file ? "border-green-400 bg-green-50 text-green-800" : "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.eml,.msg,.html,.htm,.txt,image/*,application/pdf,message/rfc822"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setErr(null);
          }}
        />
        {file ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span className="truncate">
              {file.name}{" "}
              <span className="mono text-[10px] text-slate-500">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>
              Attach the GoFundMe confirmation email or receipt (PDF, .eml,
              screenshot…)
            </span>
          </>
        )}
      </label>

      {savedGofundmeUrls && savedGofundmeUrls.length > 1 && (
        <select
          className="mono w-full rounded border border-slate-300 px-2 py-1 text-xs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        >
          {savedGofundmeUrls.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      )}

      <input
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        placeholder={`Optional note (e.g. "donated ${amountLabel} USD = $10 CAD")`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {err && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>
      )}

      <button
        className="rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
        disabled={!file || busy}
        onClick={submit}
      >
        Settle {amountLabel}
      </button>
    </div>
  );
}
