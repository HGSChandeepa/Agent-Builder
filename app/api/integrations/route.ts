import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { INTEGRATION_CATALOG } from "@/src/integrations/catalog";
import {
  disconnectGmail,
  listIntegrationConnections,
  startGmailOAuth,
} from "@/src/integrations/providers/gmail/service";
import { auditTrail } from "@/src/security/audit/audit_trail";

function getOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function GET(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const connections = await listIntegrationConnections();
  const catalog = INTEGRATION_CATALOG.map((entry) => {
    const connection = connections.find((item) => item.provider === entry.id);
    return {
      ...entry,
      connection: connection ?? null,
    };
  });
  return NextResponse.json({ catalog, connections });
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  const provider = String(body.provider ?? "");
  const action = String(body.action ?? "connect");
  const origin = getOrigin(request);
  try {
    if (provider === "gmail" && action === "connect") {
      const { authUrl, state } = startGmailOAuth(origin);
      auditTrail.record("integration.oauth.started", "system", "integration", provider, { provider });
      const response = NextResponse.json({ authUrl, state });
      response.cookies.set("gmail_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      return response;
    }
    if (provider === "gmail" && action === "disconnect") {
      await disconnectGmail(origin);
      auditTrail.record("integration.disconnected", "system", "integration", provider, { provider });
      return NextResponse.json({ success: true });
    }
    if (provider === "gmail" && action === "reconnect") {
      const { authUrl, state } = startGmailOAuth(origin);
      const response = NextResponse.json({ authUrl, state });
      response.cookies.set("gmail_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      return response;
    }
    return NextResponse.json({ error: "Unsupported integration action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration action failed" },
      { status: 500 },
    );
  }
}
