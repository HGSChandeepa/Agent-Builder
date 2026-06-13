import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import {
  deleteTrigger,
  getTrigger,
  listTriggerExecutions,
  updateTrigger,
} from "@/src/core/triggers/repository";
import { auditTrail } from "@/src/security/audit/audit_trail";
import type { UpdateTriggerInput } from "@/src/core/triggers/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await context.params;
  const trigger = await getTrigger(id);
  if (!trigger) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }
  const executions = await listTriggerExecutions(id);
  return NextResponse.json({ trigger, executions });
}

export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await context.params;
  const body = (await request.json()) as UpdateTriggerInput;
  try {
    const trigger = await updateTrigger(id, body);
    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }
    auditTrail.record("trigger.updated", "system", "trigger", trigger.id, {
      enabled: trigger.enabled,
    });
    return NextResponse.json({ trigger });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update trigger" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await context.params;
  const deleted = await deleteTrigger(id);
  if (!deleted) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }
  auditTrail.record("trigger.deleted", "system", "trigger", id, {});
  return NextResponse.json({ success: true });
}
