import { getSettings } from "@/lib/settings";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-500">
          Default donation, GoFundMe campaigns, weekly void budget.
        </p>
      </header>
      <SettingsClient initial={settings} />
    </div>
  );
}
