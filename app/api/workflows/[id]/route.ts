import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { deleteAgent, getAgent, updateAgent } from "@/src/core/workflow/repository";
import { validateWorkflow } from "@/src/core/workflow/validator";
import { nodePluginRegistry } from "@/src/core/nodes/registry";
import { auditTrail } from "@/src/security/audit/audit_trail";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await params;
  const workflow = await getAgent(id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  const validation = validateWorkflow(workflow, nodePluginRegistry);
  return NextResponse.json({ workflow, validation });
}

export async function PUT(request: Request, { params }: RouteParams): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await params;
  const body = await request.json();
  const workflow = await updateAgent(id, body);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  auditTrail.record("workflow.updated", "system", "workflow", workflow.id, { version: workflow.version });
  const validation = validateWorkflow(workflow, nodePluginRegistry);
  return NextResponse.json({ workflow, validation });
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await params;
  const deleted = await deleteAgent(id);
  if (!deleted) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  auditTrail.record("workflow.deleted", "system", "workflow", id, {});
  return NextResponse.json({ success: true });
}
