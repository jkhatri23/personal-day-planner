import { NextResponse, NextRequest } from "next/server";

// Expose the request path to server components so ReckonGate can decide
// whether the current route is allowed during a pending reckoning.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
