export type PortDataType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "trigger";

export type WorkflowEnvironment = "development" | "staging" | "production";

export type WorkflowStatus = "draft" | "published" | "archived";

export interface PortDefinition {
  readonly id: string;
  readonly label: string;
  readonly dataType: PortDataType;
  readonly required?: boolean;
}

export interface NodeDefinition {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly config: Record<string, unknown>;
}

export interface EdgeDefinition {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly environment: WorkflowEnvironment;
  readonly status: WorkflowStatus;
  readonly nodes: readonly NodeDefinition[];
  readonly edges: readonly EdgeDefinition[];
  readonly integrations: AgentIntegrationsConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
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

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface CreateWorkflowInput {
  readonly name: string;
  readonly description?: string;
  readonly environment?: WorkflowEnvironment;
  readonly integrations?: AgentIntegrationsConfig;
}

export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly description?: string;
  readonly nodes?: readonly NodeDefinition[];
  readonly edges?: readonly EdgeDefinition[];
  readonly status?: WorkflowStatus;
  readonly environment?: WorkflowEnvironment;
  readonly integrations?: AgentIntegrationsConfig;
}
