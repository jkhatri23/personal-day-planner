import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { ReckonGate } from "@/components/ReckonGate";

export const metadata: Metadata = {
  title: "Accountability Planner",
  description: "Plan weekly. Execute daily. Reckon honestly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900">
        <ReckonGate>
          <NavBar />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </ReckonGate>
      </body>
    </html>
  );
}
