/**
 * Security Headers Middleware
 *
 * Adds standard security headers to all responses.
 * Applied at the Bun.serve() fetch level.
 */

/**
 * Wrap the entire server handler to add security headers to every response.
 */
export function withSecurityHeaders(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    headers.set("X-XSS-Protection", "0");
    return new Response(res.body, { status: res.status, headers });
  };
}
