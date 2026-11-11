/**
 * Typed client-side fetch helper.
 * API responses use a single error envelope:
 *   { error: { code: string, message: string, details?: unknown } }
 */

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export class ApiException extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const envelope = body as { error?: ApiError } | null;
    const err = envelope?.error;
    throw new ApiException(
      res.status,
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? `Request failed with status ${res.status}`,
      err?.details
    );
  }

  return body as T;
}
