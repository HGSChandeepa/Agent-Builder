import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { INTEGRATION_CATALOG } from "@/src/integrations/catalog";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  return NextResponse.json({ catalog: INTEGRATION_CATALOG });
}
