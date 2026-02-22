/**
 * Rate Limiting Middleware
 *
 * In-memory sliding window rate limiter.
 * Uses the same wrapper pattern as requireAuth().
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 120_000) { // 2x the default window
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extract client IP from request.
 * Uses x-forwarded-for (Railway proxy) with fallback.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

function getRateLimitKey(req: Request, includePath = false): string {
  const override = (req as Request & { corsairRateLimitKey?: string }).corsairRateLimitKey;
  if (override && typeof override === "string" && override.trim().length > 0) {
    return override;
  }
  const ip = getClientIp(req);
  if (!includePath) return ip;
  const path = new URL(req.url).pathname;
  return `${ip}:${req.method}:${path}`;
}

type RateLimitDb = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<{ count: number }>>;

/**
 * Wrap a request handler with rate limiting.
 * Returns 429 Too Many Requests when limit exceeded.
 *
 * @param limit - Maximum requests per window
 * @param windowMs - Window duration in milliseconds (default: 60000 = 1 minute)
 */
export function rateLimit(
  limit: number,
  windowMs = 60_000,
): (handler: (req: Request) => Response | Promise<Response>) => (req: Request) => Response | Promise<Response> {
  return (handler) => {
    return async (req: Request) => {
      const ip = getRateLimitKey(req);
      const now = Date.now();
      const entry = store.get(ip);

      if (!entry || now - entry.windowStart >= windowMs) {
        store.set(ip, { count: 1, windowStart: now });
      } else {
        entry.count++;
        if (entry.count > limit) {
          const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
          return new Response(
            JSON.stringify({ error: "Too many requests" }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": String(retryAfter),
                "access-control-allow-origin": "*",
              },
            },
          );
        }
      }

      return handler(req);
    };
  };
}

/**
 * Postgres-backed rate limiter.
 *
 * Uses a fixed window keyed by IP + method + path.
 */
export function rateLimitPg(
  db: RateLimitDb,
  limit: number,
  windowMs = 60_000,
): (handler: (req: Request) => Response | Promise<Response>) => (req: Request) => Response | Promise<Response> {
  return (handler) => {
    return async (req: Request) => {
      const key = getRateLimitKey(req, true);
      const now = Date.now();
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const windowStart = new Date(windowStartMs);

      let count = 0;
      try {
        const rows = await db`
          INSERT INTO rate_limits (key, window_start, count)
          VALUES (${key}, ${windowStart}, 1)
          ON CONFLICT (key, window_start)
          DO UPDATE SET count = rate_limits.count + 1
          RETURNING count
        `;
        count = rows[0]?.count ?? 0;
      } catch {
        // Fail open if rate limiter is unavailable
        return handler(req);
      }

      if (count > limit) {
        const retryAfter = Math.ceil((windowStartMs + windowMs - now) / 1000);
        return new Response(
          JSON.stringify({ error: "Too many requests" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": String(retryAfter),
              "access-control-allow-origin": "*",
            },
          },
        );
      }

      return handler(req);
    };
  };
}

/** Reset rate limit store (for testing) */
export function resetRateLimitStore(): void {
  store.clear();
}
