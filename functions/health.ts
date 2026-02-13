/**
 * Health Check Endpoint
 * GET /health
 *
 * Returns service status with database connectivity check.
 */

export interface HealthDeps {
  db: { query(sql: string): Promise<unknown[]> } | { [Symbol.asyncDispose]?: unknown };
}

/**
 * Create a health handler that checks database connectivity.
 * Falls back to "degraded" status if DB is unreachable.
 */
export function createHealthHandler(deps: { db: unknown }): (req: Request) => Promise<Response> {
  return async (_req: Request): Promise<Response> => {
    let dbOk = false;
    try {
      // Bun.sql tagged template: db`SELECT 1`
      const db = deps.db as any;
      await db`SELECT 1`;
      dbOk = true;
    } catch {
      // DB unreachable — report degraded
    }

    const status = dbOk ? "ok" : "degraded";
    return Response.json(
      {
        status,
        version: "0.6.0",
        timestamp: new Date().toISOString(),
        checks: {
          database: dbOk ? "connected" : "unreachable",
        },
      },
      {
        status: dbOk ? 200 : 503,
        headers: { "content-type": "application/json" },
      },
    );
  };
}

/**
 * Legacy handler for backwards compatibility (no DB check).
 * @deprecated Use createHealthHandler() with DB dependency instead.
 */
export function handleHealth(_req: Request): Response {
  return Response.json(
    {
      status: "ok",
      version: "0.6.0",
      timestamp: new Date().toISOString(),
      checks: {
        database: "not-checked",
      },
    },
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}
