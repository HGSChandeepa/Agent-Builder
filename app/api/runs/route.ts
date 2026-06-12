import { NextResponse } from "next/server";
import { ensurePlatformReady, executionEngine } from "@/src/lib/bootstrap";
import { runStore } from "@/src/core/execution/engine";
import { auditTrail } from "@/src/security/audit/audit_trail";

export async function GET(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId");
  const runs = workflowId
    ? await runStore.getByWorkflow(workflowId)
    : await runStore.getAll();
  return NextResponse.json({ runs });
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  try {
    const run = await executionEngine.execute({
      workflowId: body.workflowId,
      triggerType: body.triggerType ?? "ManualTrigger",
      input: body.input ?? {},
      isSimulation: body.isSimulation ?? false,
    });
    auditTrail.record("run.started", "system", "run", run.id, {
      workflowId: run.workflowId,
      isSimulation: run.isSimulation,
    });
    if (run.status === "completed") {
      auditTrail.record("run.completed", "system", "run", run.id, {});
    } else if (run.status === "failed") {
      auditTrail.record("run.failed", "system", "run", run.id, { error: run.error });
    } else if (run.status === "waiting_approval") {
      auditTrail.record("approval.requested", "system", "run", run.id, {});
    }
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 400 },
    );
  }
}
