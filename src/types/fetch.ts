export type FetchLike = ((
  input: Request | URL | string,
  init?: RequestInit,
) => Promise<Response>) & {
  preconnect?: (url: string | URL, options?: Record<string, unknown>) => void;
};
