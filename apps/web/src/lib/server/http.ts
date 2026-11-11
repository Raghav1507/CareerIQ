/** Small helper for route handlers: uniform error envelope + JSON. */

import { NextResponse } from "next/server";

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}
