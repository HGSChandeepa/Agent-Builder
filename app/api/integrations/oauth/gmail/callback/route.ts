import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import { completeGmailOAuth } from "@/src/integrations/providers/gmail/service";
import { auditTrail } from "@/src/security/audit/audit_trail";

function getOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function GET(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = getOrigin(request);
  const redirectBase = `${origin}/integrations`;
  if (error) {
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?error=missing_oauth_params`);
  }
  const cookieStore = await cookies();
  const storedState = cookieStore.get("gmail_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${redirectBase}?error=invalid_oauth_state`);
  }
  try {
    const connection = await completeGmailOAuth(origin, code);
    auditTrail.record("integration.oauth.completed", "system", "integration", connection.id, {
      provider: "gmail",
      email: connection.accountEmail,
    });
    const response = NextResponse.redirect(`${redirectBase}?connected=gmail`);
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "oauth_failed";
    return NextResponse.redirect(`${redirectBase}?error=${encodeURIComponent(message)}`);
  }
}
