import { NextResponse, NextRequest } from "next/server";

// Expose the request path so ReckonGate can decide whether to allow the
// current route during a pending reckoning. Must live in src/ (not the repo
// root) when the project uses a src/ layout, otherwise Next.js silently
// ignores it — which would send /reckon/* into a redirect loop.
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
