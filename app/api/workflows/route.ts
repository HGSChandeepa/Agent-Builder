import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { createAgent, listAgents } from "@/src/core/workflow/repository";
import { auditTrail } from "@/src/security/audit/audit_trail";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  const workflows = await listAgents();
  return NextResponse.json({ workflows });
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  try {
    const workflow = await createAgent({
      name: body.name ?? "Untitled Workflow",
      description: body.description,
      environment: body.environment,
    });
    auditTrail.record("workflow.created", "system", "workflow", workflow.id, { name: workflow.name });
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create agent" },
      { status: 500 },
    );
  }
}
      