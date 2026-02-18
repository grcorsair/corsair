import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (host.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    const path = url.pathname === "/" ? "/docs" : `/docs${url.pathname}`;
    url.pathname = path;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|assets|recordings|robots.txt|sitemap.xml).*)"],
};
