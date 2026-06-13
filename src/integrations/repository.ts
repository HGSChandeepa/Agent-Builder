import type {
  IntegrationActivityAction,
  IntegrationActivityEntry,
  IntegrationActivityStatus,
  IntegrationConnectionStatus,
  IntegrationProviderId,
} from "@/src/integrations/types";
import { prisma } from "@/src/lib/prisma";
import type { IntegrationConnection, IntegrationActivityLog, Prisma } from "@/generated/prisma/client";

export interface StoredConnection {
  readonly id: string;
  readonly provider: IntegrationProviderId;
  readonly status: IntegrationConnectionStatus;
  readonly accountEmail: string | null;
  readonly accountName: string | null;
  readonly scopes: readonly string[];
  readonly accessTokenEnc: string | null;
  readonly refreshTokenEnc: string | null;
  readonly tokenExpiresAt: Date | null;
  readonly lastSyncAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface CreateConnectionInput {
  readonly provider: IntegrationProviderId;
  readonly accountEmail?: string | null;
  readonly accountName?: string | null;
  readonly accessTokenEnc?: string | null;
  readonly refreshTokenEnc?: string | null;
  readonly tokenExpiresAt?: Date | null;
  readonly scopes?: readonly string[];
  readonly status?: IntegrationConnectionStatus;
  readonly lastSyncAt?: Date | null;
}

interface UpdateConnectionInput {
  readonly accountEmail?: string | null;
  readonly accountName?: string | null;
  readonly accessTokenEnc?: string | null;
  readonly refreshTokenEnc?: string | null;
  readonly tokenExpiresAt?: Date | null;
  readonly scopes?: readonly string[];
  readonly status?: IntegrationConnectionStatus;
  readonly lastSyncAt?: Date | null;
  readonly lastError?: string | null;
}

interface LogActivityInput {
  readonly connectionId: string;
  readonly action: IntegrationActivityAction;
  readonly status: IntegrationActivityStatus;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

function mapConnection(record: IntegrationConnection): StoredConnection {
  return {
    id: record.id,
    provider: record.provider as IntegrationProviderId,
    status: record.status as IntegrationConnectionStatus,
    accountEmail: record.accountEmail,
    accountName: record.accountName,
    scopes: record.scopes,
    accessTokenEnc: record.accessTokenEnc,
    refreshTokenEnc: record.refreshTokenEnc,
    tokenExpiresAt: record.tokenExpiresAt,
    lastSyncAt: record.lastSyncAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toActivityEntry(record: IntegrationActivityLog & { connection: IntegrationConnection }): IntegrationActivityEntry {
  return {
    id: record.id,
    connectionId: record.connectionId,
    provider: record.connection.provider as IntegrationProviderId,
    action: record.action as IntegrationActivityAction,
    status: record.status as IntegrationActivityStatus,
    message: record.message,
    details: (record.details as Record<string, unknown>) ?? {},
    createdAt: record.createdAt.toISOString(),
  };
}

export async function listConnections(): Promise<readonly StoredConnection[]> {
  const records = await prisma.integrationConnection.findMany({ orderBy: { updatedAt: "desc" } });
  return records.map(mapConnection);
}

export async function getConnectionById(id: string): Promise<StoredConnection | null> {
  const record = await prisma.integrationConnection.findUnique({ where: { id } });
  return record ? mapConnection(record) : null;
}

export async function getConnectionByProvider(provider: IntegrationProviderId): Promise<StoredConnection | null> {
  const record = await prisma.integrationConnection.findFirst({
    where: { provider },
    orderBy: { updatedAt: "desc" },
  });
  return record ? mapConnection(record) : null;
}

export async function createConnection(input: CreateConnectionInput): Promise<StoredConnection> {
  const record = await prisma.integrationConnection.create({
    data: {
      provider: input.provider,
      status: input.status ?? "connected",
      accountEmail: input.accountEmail ?? null,
      accountName: input.accountName ?? null,
      accessTokenEnc: input.accessTokenEnc ?? null,
      refreshTokenEnc: input.refreshTokenEnc ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      scopes: [...(input.scopes ?? [])],
      lastSyncAt: input.lastSyncAt ?? null,
    },
  });
  return mapConnection(record);
}

export async function updateConnectionTokens(
  id: string,
  input: UpdateConnectionInput,
): Promise<StoredConnection> {
  const record = await prisma.integrationConnection.update({
    where: { id },
    data: {
      accountEmail: input.accountEmail,
      accountName: input.accountName,
      accessTokenEnc: input.accessTokenEnc,
      refreshTokenEnc: input.refreshTokenEnc,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes ? [...input.scopes] : undefined,
      status: input.status,
      lastSyncAt: input.lastSyncAt,
      lastError: input.lastError,
    },
  });
  return mapConnection(record);
}

export async function disconnectConnection(id: string): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id },
    data: {
      status: "disconnected",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      lastError: null,
    },
  });
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  await prisma.integrationActivityLog.create({
    data: {
      connectionId: input.connectionId,
      action: input.action,
      status: input.status,
      message: input.message,
      details: (input.details ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listActivityLogs(limit = 50): Promise<readonly IntegrationActivityEntry[]> {
  const records = await prisma.integrationActivityLog.findMany({
    include: { connection: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return records.map(toActivityEntry);
}

export async function getActivityStats(provider?: IntegrationProviderId): Promise<{
  emailsProcessed: number;
  triggersExecuted: number;
  emailsSent: number;
  failedActions: number;
  authIssues: number;
}> {
  const where = provider
    ? { connection: { provider } }
    : undefined;
  const [emailsProcessed, triggersExecuted, emailsSent, failedActions, authIssues] = await Promise.all([
    prisma.integrationActivityLog.count({ where: { ...where, action: "email_processed" } }),
    prisma.integrationActivityLog.count({ where: { ...where, action: "trigger_executed" } }),
    prisma.integrationActivityLog.count({ where: { ...where, action: "email_sent" } }),
    prisma.integrationActivityLog.count({ where: { ...where, action: "failed_action" } }),
    prisma.integrationActivityLog.count({ where: { ...where, action: "auth_error" } }),
  ]);
  return { emailsProcessed, triggersExecuted, emailsSent, failedActions, authIssues };
}
