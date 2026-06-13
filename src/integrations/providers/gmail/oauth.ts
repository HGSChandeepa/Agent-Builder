import { randomBytes } from "crypto";
import type { GmailOAuthConfig } from "@/src/integrations/providers/gmail/config";
import { GMAIL_OAUTH_SCOPES } from "@/src/integrations/providers/gmail/config";

export interface GmailTokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
  readonly scope?: string;
}

export interface GmailUserInfo {
  readonly email: string;
  readonly name?: string;
}

export function createOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildGmailAuthUrl(config: GmailOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailAuthCode(
  config: GmailOAuthConfig,
  code: string,
): Promise<GmailTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json()) as GmailTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Failed to exchange authorization code");
  }
  return data;
}

export async function refreshGmailAccessToken(
  config: GmailOAuthConfig,
  refreshToken: string,
): Promise<GmailTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as GmailTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Failed to refresh access token");
  }
  return data;
}

export async function fetchGmailUserInfo(accessToken: string): Promise<GmailUserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as { email?: string; name?: string; error?: { message?: string } };
  if (!response.ok || !data.email) {
    throw new Error(data.error?.message ?? "Failed to fetch Gmail account info");
  }
  return { email: data.email, name: data.name };
}

export async function revokeGmailToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}
