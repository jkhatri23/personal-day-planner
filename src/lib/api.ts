import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function bad(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, detail: extra }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return bad("Invalid input", 422, e.flatten());
  }
  if (e instanceof Error) {
    console.error(e);
    return bad(e.message, 400);
  }
  return bad("Unknown error", 500);
}
