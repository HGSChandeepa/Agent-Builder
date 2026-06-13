export const GMAIL_OAUTH_SCOPES: readonly string[] = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export const GMAIL_PROVIDER_ID = "gmail" as const;

export interface GmailOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function getGmailOAuthConfig(origin: string): GmailOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${origin.replace(/\/$/, "")}/api/integrations/oauth/gmail/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isGmailOAuthConfigured(config: GmailOAuthConfig): boolean {
  return Boolean(config.clientId && config.clientSecret);
}
