import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const securityHeaders = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none'",
};

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  if (host.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    const path = url.pathname === "/" ? "/docs" : `/docs${url.pathname}`;
    url.pathname = path;
    const response = NextResponse.rewrite(url);
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|assets|recordings|robots.txt|sitemap.xml).*)"],
};
