import { NextResponse } from "next/server";
import { ensurePlatformReady, executionEngine } from "@/src/lib/bootstrap";
import { auditTrail } from "@/src/security/audit/audit_trail";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  ensurePlatformReady();
  const { id } = await params;
  const body = await request.json();
  try {
    const run = await executionEngine.resumeAfterApproval(
      id,
      body.approvalId,
      body.approved ?? true,
      body.resolvedBy ?? "system",
    );
    auditTrail.record(
      body.approved ? "approval.approved" : "approval.rejected",
      body.resolvedBy ?? "system",
      "run",
      id,
      { approvalId: body.approvalId },
    );
    if (run.status === "completed") {
      auditTrail.record("run.completed", "system", "run", run.id, {});
    }
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed" },
      { status: 400 },
    );
  }
}
