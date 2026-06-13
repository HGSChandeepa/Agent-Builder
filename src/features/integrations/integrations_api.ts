import type {
  AgentIntegrationsConfig,
  IntegrationActivityEntry,
  IntegrationCatalogEntry,
  IntegrationConnectionSummary,
} from "@/src/integrations/types";

export interface IntegrationCatalogItem extends IntegrationCatalogEntry {
  readonly connection: IntegrationConnectionSummary | null;
}

export interface IntegrationsPageData {
  readonly catalog: readonly IntegrationCatalogItem[];
  readonly connections: readonly IntegrationConnectionSummary[];
}

export interface ActivityDashboardData {
  readonly logs: readonly IntegrationActivityEntry[];
  readonly stats: {
    readonly emailsProcessed: number;
    readonly triggersExecuted: number;
    readonly emailsSent: number;
    readonly failedActions: number;
    readonly authIssues: number;
  };
}

export async function fetchIntegrationsPageData(): Promise<IntegrationsPageData> {
  const response = await fetch("/api/integrations");
  if (!response.ok) {
    throw new Error("Failed to load integrations");
  }
  return response.json() as Promise<IntegrationsPageData>;
}

export async function connectIntegration(provider: string): Promise<{ authUrl: string }> {
  const response = await fetch("/api/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, action: "connect" }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to start connection");
  }
  return data as { authUrl: string };
}

export async function disconnectIntegration(provider: string): Promise<void> {
  const response = await fetch("/api/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, action: "disconnect" }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "Failed to disconnect");
  }
}

export async function reconnectIntegration(provider: string): Promise<{ authUrl: string }> {
  const response = await fetch("/api/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, action: "reconnect" }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to reconnect");
  }
  return data as { authUrl: string };
}

export async function fetchActivityDashboard(): Promise<ActivityDashboardData> {
  const response = await fetch("/api/integrations/activity?limit=50");
  if (!response.ok) {
    throw new Error("Failed to load activity");
  }
  return response.json() as Promise<ActivityDashboardData>;
}

export async function fetchIntegrationConnections(): Promise<readonly IntegrationConnectionSummary[]> {
  const response = await fetch("/api/integrations");
  if (!response.ok) {
    throw new Error("Failed to load connections");
  }
  const data = await response.json();
  return data.connections as readonly IntegrationConnectionSummary[];
}

export type { AgentIntegrationsConfig };
