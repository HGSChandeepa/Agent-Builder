export type IntegrationProviderId =
  | "gmail"
  | "outlook"
  | "slack"
  | "microsoft_teams"
  | "google_drive"
  | "notion"
  | "hubspot";

export type IntegrationConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "token_expired";

export type IntegrationActivityAction =
  | "email_processed"
  | "trigger_executed"
  | "email_sent"
  | "email_preview"
  | "failed_action"
  | "auth_error"
  | "connection_sync";

export type IntegrationActivityStatus = "success" | "failure" | "warning";

export interface IntegrationCatalogEntry {
  readonly id: IntegrationProviderId;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly isAvailable: boolean;
  readonly comingSoon: boolean;
  readonly permissions: readonly string[];
  readonly logoColor: string;
}

export interface IntegrationConnectionSummary {
  readonly id: string;
  readonly provider: IntegrationProviderId;
  readonly status: IntegrationConnectionStatus;
  readonly accountEmail: string | null;
  readonly accountName: string | null;
  readonly scopes: readonly string[];
  readonly lastSyncAt: string | null;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IntegrationActivityEntry {
  readonly id: string;
  readonly connectionId: string;
  readonly provider: IntegrationProviderId;
  readonly action: IntegrationActivityAction;
  readonly status: IntegrationActivityStatus;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly createdAt: string;
}

export interface GmailMonitoringRules {
  readonly senderFilter: string;
  readonly subjectKeywords: string;
  readonly labels: string;
  readonly unreadOnly: boolean;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly pollIntervalMinutes: number;
  readonly realtime: boolean;
}

export interface GmailAgentIntegrationConfig {
  readonly provider: "gmail";
  readonly connectionId: string;
  readonly monitoringRules: GmailMonitoringRules;
  readonly autoReplyEnabled: boolean;
  readonly replyTemplate: string;
  readonly outgoingTemplate: string;
}

export interface AgentIntegrationsConfig {
  readonly gmail?: GmailAgentIntegrationConfig;
}

export const DEFAULT_GMAIL_MONITORING_RULES: GmailMonitoringRules = {
  senderFilter: "",
  subjectKeywords: "",
  labels: "INBOX",
  unreadOnly: true,
  dateFrom: "",
  dateTo: "",
  pollIntervalMinutes: 5,
  realtime: false,
};
