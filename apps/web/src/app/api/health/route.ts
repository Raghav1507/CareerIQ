import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * System health for the dashboard and operators.
 * - db: real `select version()` round-trip
 * - ai: authenticated service-to-service ping to the FastAPI process
 * Never fabricates status; failures are reported as failures.
 */
export async function GET() {
  const health = await getSystemHealth();
  return NextResponse.json(health, { status: 200 });
}
