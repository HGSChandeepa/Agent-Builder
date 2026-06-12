import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { auditTrail } from "@/src/security/audit/audit_trail";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  return NextResponse.json({ entries: auditTrail.getAll() });
}
