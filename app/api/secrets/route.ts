import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { secretsVault } from "@/src/security/secrets/vault";
import { auditTrail } from "@/src/security/audit/audit_trail";

export async function GET(): Promise<NextResponse> {
  ensurePlatformReady();
  return NextResponse.json({ credentials: secretsVault.getCredentials() });
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  if (body.action === "setSecret") {
    const success = secretsVault.setSecret(body.credentialId, body.key, body.value);
    if (!success) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }
    auditTrail.record("secret.accessed", "system", "credential", body.credentialId, { action: "set" });
    return NextResponse.json({ success: true });
  }
  const credential = secretsVault.createCredential(
    body.name ?? "New Credential",
    body.type ?? "api_key",
    body.scopes ?? ["*"],
  );
  auditTrail.record("secret.accessed", "system", "credential", credential.id, { action: "create" });
  return NextResponse.json({ credential }, { status: 201 });
}
