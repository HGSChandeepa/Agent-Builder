export type TriggerScheduleType = "interval" | "daily" | "weekly" | "cron";

export interface IntervalScheduleConfig {
  readonly minutes: number;
}

export interface DailyScheduleConfig {
  readonly hour: number;
  readonly minute: number;
}

export interface WeeklyScheduleConfig {
  readonly dayOfWeek: number;
  readonly hour: number;
  readonly minute: number;
}

export interface CronScheduleConfig {
  readonly expression: string;
}

export type TriggerScheduleConfig =
  | IntervalScheduleConfig
  | DailyScheduleConfig
  | WeeklyScheduleConfig
  | CronScheduleConfig;

export interface AgentTriggerDefinition {
  readonly id: string;
  readonly agentId: string;
  readonly agentName: string;
  readonly name: string;
  readonly scheduleType: TriggerScheduleType;
  readonly scheduleConfig: TriggerScheduleConfig;
  readonly timezone: string;
  readonly enabled: boolean;
  readonly input: Record<string, unknown>;
  readonly lastRunAt: string | null;
  readonly nextRunAt: string | null;
  readonly lastRunStatus: string | null;
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly failedRuns: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TriggerExecutionRecord {
  readonly id: string;
  readonly triggerId: string;
  readonly runId: string | null;
  readonly status: string;
  readonly scheduledFor: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface CreateTriggerInput {
  readonly agentId: string;
  readonly name: string;
  readonly scheduleType: TriggerScheduleType;
  readonly scheduleConfig: TriggerScheduleConfig;
  readonly timezone?: string;
  readonly enabled?: boolean;
  readonly input?: Record<string, unknown>;
}

export interface UpdateTriggerInput {
  readonly name?: string;
  readonly scheduleType?: TriggerScheduleType;
  readonly scheduleConfig?: TriggerScheduleConfig;
  readonly timezone?: string;
  readonly enabled?: boolean;
  readonly input?: Record<string, unknown>;
}

export interface TriggersPageMetrics {
  readonly totalTriggers: number;
  readonly activeTriggers: number;
  readonly pausedTriggers: number;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly nextScheduledRun: string | null;
}

export interface TriggersPageData {
  readonly triggers: readonly AgentTriggerDefinition[];
  readonly metrics: TriggersPageMetrics;
  readonly recentExecutions: readonly TriggerExecutionRecord[];
}
