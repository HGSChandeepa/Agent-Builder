import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { connectorGateway } from "@/src/integrations/connectors/gateway";
import { auditTrail } from "@/src/security/audit/audit_trail";

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  const response = await connectorGateway.execute({
    connectorType: body.connectorType ?? "http",
    credentialId: body.credentialId,
    scope: body.scope ?? "http:read",
    isSimulation: body.isSimulation ?? true,
    payload: body.payload ?? {},
  });
  if (!response.success) {
    auditTrail.record("policy.violation", "system", "connector", body.connectorType ?? "http", {
      error: response.error,
    });
  }
  return NextResponse.json({ response });
}
