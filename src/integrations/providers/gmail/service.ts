import type {
  IntegrationActivityAction,
  IntegrationActivityStatus,
  IntegrationConnectionSummary,
  IntegrationProviderId,
  GmailMonitoringRules,
} from "@/src/integrations/types";
import type { GmailSendEmailInput } from "@/src/integrations/providers/gmail/client";
import { decryptToken, encryptToken } from "@/src/integrations/crypto/token_encryption";
import {
  buildGmailAuthUrl,
  createOAuthState,
  exchangeGmailAuthCode,
  fetchGmailUserInfo,
  refreshGmailAccessToken,
  revokeGmailToken,
} from "@/src/integrations/providers/gmail/oauth";
import { getGmailOAuthConfig, isGmailOAuthConfigured } from "@/src/integrations/providers/gmail/config";
import { GmailApiClient, buildGmailSearchQuery } from "@/src/integrations/providers/gmail/client";
import {
  createConnection,
  disconnectConnection,
  getConnectionById,
  getConnectionByProvider,
  listConnections,
  logActivity,
  updateConnectionTokens,
  type StoredConnection,
} from "@/src/integrations/repository";

const oauthStates = new Map<string, { createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of oauthStates.entries()) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      oauthStates.delete(state);
    }
  }
}

function toSummary(connection: StoredConnection): IntegrationConnectionSummary {
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    accountEmail: connection.accountEmail,
    accountName: connection.accountName,
    scopes: connection.scopes,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastError: connection.lastError,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

async function recordActivity(
  connectionId: string,
  action: IntegrationActivityAction,
  status: IntegrationActivityStatus,
  message: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await logActivity({ connectionId, action, status, message, details });
}

async function getValidAccessToken(connection: StoredConnection, origin: string): Promise<string> {
  if (!connection.accessTokenEnc) {
    throw new Error("Gmail account is not connected");
  }
  const accessToken = decryptToken(connection.accessTokenEnc);
  const isExpired =
    connection.tokenExpiresAt !== null && connection.tokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!isExpired) {
    return accessToken;
  }
  if (!connection.refreshTokenEnc) {
    await updateConnectionTokens(connection.id, {
      status: "token_expired",
      lastError: "Access token expired and no refresh token is available. Please reconnect.",
    });
    await recordActivity(connection.id, "auth_error", "failure", "Gmail access token expired");
    throw new Error("Gmail session expired. Reconnect your account from Integrations.");
  }
  const config = getGmailOAuthConfig(origin);
  if (!isGmailOAuthConfigured(config)) {
    throw new Error("Google OAuth is not configured on the server");
  }
  try {
    const refreshToken = decryptToken(connection.refreshTokenEnc);
    const tokenResponse = await refreshGmailAccessToken(config, refreshToken);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    await updateConnectionTokens(connection.id, {
      accessTokenEnc: encryptToken(tokenResponse.access_token),
      refreshTokenEnc: tokenResponse.refresh_token
        ? encryptToken(tokenResponse.refresh_token)
        : connection.refreshTokenEnc,
      tokenExpiresAt: expiresAt,
      status: "connected",
      lastError: null,
    });
    return tokenResponse.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token refresh failed";
    await updateConnectionTokens(connection.id, {
      status: "token_expired",
      lastError: message,
    });
    await recordActivity(connection.id, "auth_error", "failure", message);
    throw new Error(`Gmail authentication failed: ${message}`);
  }
}

export async function listIntegrationConnections(): Promise<readonly IntegrationConnectionSummary[]> {
  const connections = await listConnections();
  return connections.map(toSummary);
}

export async function getGmailConnection(): Promise<IntegrationConnectionSummary | null> {
  const connection = await getConnectionByProvider("gmail");
  return connection ? toSummary(connection) : null;
}

export function startGmailOAuth(origin: string): { authUrl: string; state: string } {
  cleanupExpiredStates();
  const config = getGmailOAuthConfig(origin);
  if (!isGmailOAuthConfigured(config)) {
    throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Gmail");
  }
  const state = createOAuthState();
  oauthStates.set(state, { createdAt: Date.now() });
  return { authUrl: buildGmailAuthUrl(config, state), state };
}

export function validateOAuthState(state: string): boolean {
  cleanupExpiredStates();
  const entry = oauthStates.get(state);
  if (!entry) {
    return false;
  }
  oauthStates.delete(state);
  return Date.now() - entry.createdAt <= STATE_TTL_MS;
}

export async function completeGmailOAuth(origin: string, code: string): Promise<IntegrationConnectionSummary> {
  const config = getGmailOAuthConfig(origin);
  const tokenResponse = await exchangeGmailAuthCode(config, code);
  const userInfo = await fetchGmailUserInfo(tokenResponse.access_token);
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
  const scopes = tokenResponse.scope?.split(" ") ?? [];
  const existing = await getConnectionByProvider("gmail");
  const connection = existing
    ? await updateConnectionTokens(existing.id, {
        accountEmail: userInfo.email,
        accountName: userInfo.name ?? null,
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: tokenResponse.refresh_token
          ? encryptToken(tokenResponse.refresh_token)
          : existing.refreshTokenEnc,
        tokenExpiresAt: expiresAt,
        scopes,
        status: "connected",
        lastError: null,
        lastSyncAt: new Date(),
      })
    : await createConnection({
        provider: "gmail",
        accountEmail: userInfo.email,
        accountName: userInfo.name ?? null,
        accessTokenEnc: encryptToken(tokenResponse.access_token),
        refreshTokenEnc: tokenResponse.refresh_token ? encryptToken(tokenResponse.refresh_token) : null,
        tokenExpiresAt: expiresAt,
        scopes,
        status: "connected",
        lastSyncAt: new Date(),
      });
  await recordActivity(connection.id, "connection_sync", "success", `Connected Gmail account ${userInfo.email}`, {
    email: userInfo.email,
  });
  return toSummary(connection);
}

export async function disconnectGmail(origin: string): Promise<void> {
  const connection = await getConnectionByProvider("gmail");
  if (!connection) {
    return;
  }
  if (connection.accessTokenEnc) {
    try {
      const accessToken = decryptToken(connection.accessTokenEnc);
      await revokeGmailToken(accessToken);
    } catch {
      /* revocation is best-effort */
    }
  }
  await disconnectConnection(connection.id);
  await recordActivity(connection.id, "connection_sync", "success", "Gmail account disconnected");
}

export async function syncGmailInbox(
  connectionId: string,
  origin: string,
  rules: Partial<GmailMonitoringRules>,
  maxResults = 10,
): Promise<{ messages: Awaited<ReturnType<GmailApiClient["listMessages"]>>; query: string }> {
  const connection = await getConnectionById(connectionId);
  if (!connection || connection.provider !== "gmail") {
    throw new Error("Gmail connection not found");
  }
  const accessToken = await getValidAccessToken(connection, origin);
  const client = new GmailApiClient(accessToken);
  const query = buildGmailSearchQuery(rules);
  try {
    const messages = await client.listMessages(query, maxResults);
    await updateConnectionTokens(connectionId, { lastSyncAt: new Date(), lastError: null, status: "connected" });
    await recordActivity(connectionId, "email_processed", "success", `Processed ${messages.length} matching emails`, {
      query,
      count: messages.length,
    });
    return { messages, query };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync Gmail inbox";
    await updateConnectionTokens(connectionId, { lastError: message, status: "error" });
    await recordActivity(connectionId, "failed_action", "failure", message, { query });
    throw error;
  }
}

export async function readGmailMessage(
  connectionId: string,
  origin: string,
  messageId: string,
  includeBody = true,
): Promise<Awaited<ReturnType<GmailApiClient["getMessage"]>>> {
  const connection = await getConnectionById(connectionId);
  if (!connection || connection.provider !== "gmail") {
    throw new Error("Gmail connection not found");
  }
  const accessToken = await getValidAccessToken(connection, origin);
  const client = new GmailApiClient(accessToken);
  const message = await client.getMessage(messageId, includeBody);
  await recordActivity(connectionId, "email_processed", "success", `Read email: ${message.subject}`, {
    messageId,
    subject: message.subject,
  });
  return message;
}

export async function sendGmailEmail(
  connectionId: string,
  origin: string,
  input: GmailSendEmailInput,
): Promise<Awaited<ReturnType<GmailApiClient["sendEmail"]>>> {
  const connection = await getConnectionById(connectionId);
  if (!connection || connection.provider !== "gmail") {
    throw new Error("Gmail connection not found");
  }
  const accessToken = await getValidAccessToken(connection, origin);
  const client = new GmailApiClient(accessToken);
  try {
    const result = await client.sendEmail(input);
    await recordActivity(
      connectionId,
      input.previewOnly ? "email_preview" : "email_sent",
      "success",
      input.previewOnly ? `Previewed email to ${input.to.join(", ")}` : `Sent email to ${input.to.join(", ")}`,
      {
        to: input.to,
        subject: input.subject,
        messageId: result.messageId,
        previewOnly: Boolean(input.previewOnly),
      },
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    await recordActivity(connectionId, "failed_action", "failure", message, { subject: input.subject });
    throw error;
  }
}

export async function getActivityStats(provider?: IntegrationProviderId): Promise<{
  emailsProcessed: number;
  triggersExecuted: number;
  emailsSent: number;
  failedActions: number;
  authIssues: number;
}> {
  const { getActivityStats: fetchStats } = await import("@/src/integrations/repository");
  return fetchStats(provider);
}
