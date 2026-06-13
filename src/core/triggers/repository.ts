import type {
  AgentTrigger as PrismaAgentTrigger,
  Prisma,
  TriggerExecution as PrismaTriggerExecution,
  TriggerScheduleType as PrismaTriggerScheduleType,
} from "@/generated/prisma/client";
import {
  computeNextRunAt,
  validateScheduleConfig,
} from "@/src/core/triggers/schedule";
import type {
  AgentTriggerDefinition,
  CreateTriggerInput,
  TriggerExecutionRecord,
  TriggerScheduleConfig,
  TriggerScheduleType,
  TriggersPageData,
  TriggersPageMetrics,
  UpdateTriggerInput,
} from "@/src/core/triggers/types";
import { prisma } from "@/src/lib/prisma";

type TriggerWithAgent = PrismaAgentTrigger & {
  agent: { name: string };
};

type ExecutionRow = PrismaTriggerExecution;

function parseScheduleConfig(value: Prisma.JsonValue): TriggerScheduleConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { minutes: 60 };
  }
  return value as unknown as TriggerScheduleConfig;
}

function parseInput(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toInputJsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toTriggerDefinition(trigger: TriggerWithAgent): AgentTriggerDefinition {
  return {
    id: trigger.id,
    agentId: trigger.agentId,
    agentName: trigger.agent.name,
    name: trigger.name,
    scheduleType: trigger.scheduleType as TriggerScheduleType,
    scheduleConfig: parseScheduleConfig(trigger.scheduleConfig),
    timezone: trigger.timezone,
    enabled: trigger.enabled,
    input: parseInput(trigger.input),
    lastRunAt: trigger.lastRunAt?.toISOString() ?? null,
    nextRunAt: trigger.nextRunAt?.toISOString() ?? null,
    lastRunStatus: trigger.lastRunStatus,
    totalRuns: trigger.totalRuns,
    successfulRuns: trigger.successfulRuns,
    failedRuns: trigger.failedRuns,
    createdAt: trigger.createdAt.toISOString(),
    updatedAt: trigger.updatedAt.toISOString(),
  };
}

function toExecutionRecord(execution: ExecutionRow): TriggerExecutionRecord {
  return {
    id: execution.id,
    triggerId: execution.triggerId,
    runId: execution.runId,
    status: execution.status,
    scheduledFor: execution.scheduledFor.toISOString(),
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString() ?? null,
    durationMs: execution.durationMs,
    error: execution.error,
    createdAt: execution.createdAt.toISOString(),
  };
}

function buildMetrics(
  triggers: readonly AgentTriggerDefinition[],
  executionStats: { total: number; successful: number; failed: number },
): TriggersPageMetrics {
  const activeTriggers = triggers.filter((trigger) => trigger.enabled).length;
  const nextScheduledRun = triggers
    .filter((trigger) => trigger.enabled && trigger.nextRunAt)
    .map((trigger) => trigger.nextRunAt as string)
    .sort()[0] ?? null;
  return {
    totalTriggers: triggers.length,
    activeTriggers,
    pausedTriggers: triggers.length - activeTriggers,
    totalExecutions: executionStats.total,
    successfulExecutions: executionStats.successful,
    failedExecutions: executionStats.failed,
    nextScheduledRun,
  };
}

export async function listTriggersPageData(): Promise<TriggersPageData> {
  const [triggerRows, recentExecutions, executionStats] = await Promise.all([
    prisma.agentTrigger.findMany({
      include: { agent: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.triggerExecution.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.triggerExecution.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const triggers = triggerRows.map(toTriggerDefinition);
  const successfulExecutions =
    executionStats.find((entry) => entry.status === "completed")?._count._all ?? 0;
  const failedExecutions =
    executionStats.find((entry) => entry.status === "failed")?._count._all ?? 0;
  const totalExecutions = executionStats.reduce((sum, entry) => sum + entry._count._all, 0);
  return {
    triggers,
    metrics: buildMetrics(triggers, {
      total: totalExecutions,
      successful: successfulExecutions,
      failed: failedExecutions,
    }),
    recentExecutions: recentExecutions.map(toExecutionRecord),
  };
}

export async function getTrigger(id: string): Promise<AgentTriggerDefinition | null> {
  const trigger = await prisma.agentTrigger.findUnique({
    where: { id },
    include: { agent: { select: { name: true } } },
  });
  return trigger ? toTriggerDefinition(trigger) : null;
}

export async function listTriggerExecutions(
  triggerId: string,
  limit: number = 20,
): Promise<readonly TriggerExecutionRecord[]> {
  const executions = await prisma.triggerExecution.findMany({
    where: { triggerId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return executions.map(toExecutionRecord);
}

export async function createTrigger(input: CreateTriggerInput): Promise<AgentTriggerDefinition> {
  const validationError = validateScheduleConfig(input.scheduleType, input.scheduleConfig);
  if (validationError) {
    throw new Error(validationError);
  }
  const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
  if (!agent) {
    throw new Error("Agent not found.");
  }
  const timezone = input.timezone ?? "UTC";
  const enabled = input.enabled ?? true;
  const nextRunAt = enabled
    ? computeNextRunAt(input.scheduleType, input.scheduleConfig, timezone)
    : null;
  const trigger = await prisma.agentTrigger.create({
    data: {
      agentId: input.agentId,
      name: input.name,
      scheduleType: input.scheduleType as PrismaTriggerScheduleType,
      scheduleConfig: toInputJsonValue(input.scheduleConfig),
      timezone,
      enabled,
      input: toInputJsonValue(input.input ?? {}),
      nextRunAt,
    },
    include: { agent: { select: { name: true } } },
  });
  return toTriggerDefinition(trigger);
}

export async function updateTrigger(
  id: string,
  input: UpdateTriggerInput,
): Promise<AgentTriggerDefinition | null> {
  const existing = await prisma.agentTrigger.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const scheduleType = (input.scheduleType ?? existing.scheduleType) as TriggerScheduleType;
  const scheduleConfig = input.scheduleConfig ?? parseScheduleConfig(existing.scheduleConfig);
  const validationError = validateScheduleConfig(scheduleType, scheduleConfig);
  if (validationError) {
    throw new Error(validationError);
  }
  const timezone = input.timezone ?? existing.timezone;
  const enabled = input.enabled ?? existing.enabled;
  const nextRunAt = enabled
    ? computeNextRunAt(scheduleType, scheduleConfig, timezone)
    : null;
  const trigger = await prisma.agentTrigger.update({
    where: { id },
    data: {
      name: input.name,
      scheduleType: input.scheduleType as PrismaTriggerScheduleType | undefined,
      scheduleConfig: input.scheduleConfig
        ? toInputJsonValue(input.scheduleConfig)
        : undefined,
      timezone: input.timezone,
      enabled: input.enabled,
      input: input.input ? toInputJsonValue(input.input) : undefined,
      nextRunAt,
    },
    include: { agent: { select: { name: true } } },
  });
  return toTriggerDefinition(trigger);
}

export async function deleteTrigger(id: string): Promise<boolean> {
  try {
    await prisma.agentTrigger.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function listDueTriggers(now: Date = new Date()): Promise<readonly AgentTriggerDefinition[]> {
  const triggers = await prisma.agentTrigger.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
    },
    include: { agent: { select: { name: true } } },
  });
  return triggers.map(toTriggerDefinition);
}

export async function recordTriggerExecutionStart(input: {
  triggerId: string;
  scheduledFor: Date;
}): Promise<TriggerExecutionRecord> {
  const execution = await prisma.triggerExecution.create({
    data: {
      triggerId: input.triggerId,
      status: "running",
      scheduledFor: input.scheduledFor,
      startedAt: new Date(),
    },
  });
  return toExecutionRecord(execution);
}

export async function recordTriggerExecutionFinish(input: {
  executionId: string;
  triggerId: string;
  runId: string | null;
  status: string;
  error?: string | null;
}): Promise<AgentTriggerDefinition | null> {
  const completedAt = new Date();
  const execution = await prisma.triggerExecution.findUnique({ where: { id: input.executionId } });
  if (!execution) {
    return null;
  }
  const durationMs = completedAt.getTime() - execution.startedAt.getTime();
  await prisma.triggerExecution.update({
    where: { id: input.executionId },
    data: {
      runId: input.runId,
      status: input.status,
      completedAt,
      durationMs,
      error: input.error ?? null,
    },
  });
  const trigger = await prisma.agentTrigger.findUnique({ where: { id: input.triggerId } });
  if (!trigger) {
    return null;
  }
  const scheduleConfig = parseScheduleConfig(trigger.scheduleConfig);
  const nextRunAt = trigger.enabled
    ? computeNextRunAt(
        trigger.scheduleType as TriggerScheduleType,
        scheduleConfig,
        trigger.timezone,
        completedAt,
      )
    : null;
  const updated = await prisma.agentTrigger.update({
    where: { id: input.triggerId },
    data: {
      lastRunAt: completedAt,
      lastRunStatus: input.status,
      nextRunAt,
      totalRuns: { increment: 1 },
      successfulRuns: input.status === "completed" ? { increment: 1 } : undefined,
      failedRuns: input.status === "failed" ? { increment: 1 } : undefined,
    },
    include: { agent: { select: { name: true } } },
  });
  return toTriggerDefinition(updated);
}

export { toExecutionRecord };
