import { prisma, USER_ID } from "./db";

export type AppSettings = {
  defaultAmountCents: number;
  weeklyVoidBudget: number;
  timezone: string;
  gofundmeUrls: string[];
};

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { userId: USER_ID },
    update: {},
    create: { userId: USER_ID },
  });
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(row.gofundmeUrlsJson);
    if (Array.isArray(parsed)) urls = parsed.filter((s) => typeof s === "string");
  } catch {
    urls = [];
  }
  return {
    defaultAmountCents: row.defaultAmountCents,
    weeklyVoidBudget: row.weeklyVoidBudget,
    timezone: row.timezone,
    gofundmeUrls: urls,
  };
}

export async function updateSettings(patch: Partial<AppSettings>) {
  const data: Record<string, unknown> = {};
  if (patch.defaultAmountCents !== undefined)
    data.defaultAmountCents = patch.defaultAmountCents;
  if (patch.weeklyVoidBudget !== undefined)
    data.weeklyVoidBudget = patch.weeklyVoidBudget;
  if (patch.timezone !== undefined) data.timezone = patch.timezone;
  if (patch.gofundmeUrls !== undefined)
    data.gofundmeUrlsJson = JSON.stringify(patch.gofundmeUrls);
  await prisma.settings.upsert({
    where: { userId: USER_ID },
    update: data,
    create: { userId: USER_ID, ...data },
  });
  return getSettings();
}
