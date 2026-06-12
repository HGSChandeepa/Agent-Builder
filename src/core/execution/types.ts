export type RunStatus =
  | "pending"
  | "running"
  | "paused"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting_approval";

export interface StepRun {
  readonly id: string;
  readonly runId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly status: StepStatus;
  readonly attempt: number;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly error?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly logs: readonly StepLogEntry[];
}

export interface StepLogEntry {
  readonly timestamp: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RunMetric {
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly timestamp: string;
}

export interface RunTraceSpan {
  readonly id: string;
  readonly parentId?: string;
  readonly nodeId: string;
  readonly name: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly status: "ok" | "error";
}

export interface ApprovalRequest {
  readonly id: string;
  readonly runId: string;
  readonly stepRunId: string;
  readonly nodeId: string;
  readonly action: string;
  readonly payload: Record<string, unknown>;
  readonly status: "pending" | "approved" | "rejected";
  readonly requestedAt: string;
  readonly resolvedAt?: string;
  readonly resolvedBy?: string;
  readonly comment?: string;
}

export interface Run {
  readonly id: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly status: RunStatus;
  readonly triggerType: string;
  readonly isSimulation: boolean;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly stepRuns: readonly StepRun[];
  readonly metrics: readonly RunMetric[];
  readonly traces: readonly RunTraceSpan[];
  readonly approvalRequests: readonly ApprovalRequest[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly error?: string;
}

export interface ExecuteWorkflowInput {
  readonly workflowId: string;
  readonly triggerType?: string;
  readonly input?: Record<string, unknown>;
  readonly isSimulation?: boolean;
}

export interface ExecutionContext {
  readonly runId: string;
  readonly workflowId: string;
  readonly isSimulation: boolean;
  readonly environment: string;
  readonly variables: Record<string, unknown>;
}
