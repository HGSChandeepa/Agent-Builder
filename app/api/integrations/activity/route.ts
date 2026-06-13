import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { getActivityStats, listActivityLogs } from "@/src/integrations/repository";
import type { IntegrationProviderId } from "@/src/integrations/types";

export async function GET(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as IntegrationProviderId | null;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const [logs, stats] = await Promise.all([
    listActivityLogs(Number.isFinite(limit) ? limit : 50),
    getActivityStats(provider ?? undefined),
  ]);
  const filteredLogs = provider ? logs.filter((log) => log.provider === provider) : logs;
  return NextResponse.json({ logs: filteredLogs, stats });
}
