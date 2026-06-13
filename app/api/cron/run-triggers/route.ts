import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { runDueTriggers } from "@/src/core/triggers/runner";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ensurePlatformReady();
  const summary = await runDueTriggers();
  return NextResponse.json({ summary });
}

export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}
