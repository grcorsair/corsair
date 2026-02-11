/**
 * Health Check Endpoint
 * GET /health
 *
 * Returns service status, version, and timestamp.
 */

export function handleHealth(_req: Request): Response {
  return Response.json(
    {
      status: "ok",
      version: "0.4.0",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
