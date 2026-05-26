import { NextRequest } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { ok, handleError } from "@/lib/api";
import { updateSettingsSchema } from "@/lib/schemas";

export async function GET() {
  try {
    return ok(await getSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = updateSettingsSchema.parse(await req.json());
    const result = await updateSettings(body);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
