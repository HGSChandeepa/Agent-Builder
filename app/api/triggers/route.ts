import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { createTrigger, listTriggersPageData } from "@/src/core/triggers/repository";
import { auditTrail } from "@/src/security/audit/audit_trail";
import type { CreateTriggerInput } from "@/src/core/triggers/types";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  try {
    const pageData = await listTriggersPageData();
    return NextResponse.json(pageData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load triggers" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = (await request.json()) as CreateTriggerInput;
  try {
    const trigger = await createTrigger(body);
    auditTrail.record("trigger.created", "system", "trigger", trigger.id, {
      agentId: trigger.agentId,
      name: trigger.name,
    });
    return NextResponse.json({ trigger }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create trigger" },
      { status: 400 },
    );
  }
}
