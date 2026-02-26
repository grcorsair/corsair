export function withPreconnect(
  fn: (input: Request | URL | string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  const mock = fn as unknown as typeof fetch;
  if (!(mock as { preconnect?: unknown }).preconnect) {
    (mock as { preconnect?: (url: string | URL, options?: Record<string, unknown>) => void })
      .preconnect = () => {};
  }
  return mock;
}
