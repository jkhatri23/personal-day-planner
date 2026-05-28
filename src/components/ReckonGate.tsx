import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { oldestUnreckonedPriorDay } from "@/lib/week";

const ALLOWED_PREFIXES = ["/reckon", "/api", "/_next", "/favicon"];

export async function ReckonGate({ children }: { children: React.ReactNode }) {
  const h = headers();
  const pathname = h.get("x-pathname");

  // Fail open if middleware didn't run — better to leak access than to send the
  // user into an infinite redirect loop they can't escape.
  if (pathname == null) return <>{children}</>;

  if (ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  const stuck = await oldestUnreckonedPriorDay();
  if (stuck) {
    redirect(`/reckon/${stuck.id}`);
  }
  return <>{children}</>;
}
