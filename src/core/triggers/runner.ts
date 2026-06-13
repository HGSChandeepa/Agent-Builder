import {
  listDueTriggers,
  recordTriggerExecutionFinish,
  recordTriggerExecutionStart,
} from "@/src/core/triggers/repository";
import type { AgentTriggerDefinition } from "@/src/core/triggers/types";
import { executionEngine } from "@/src/lib/bootstrap";
import { auditTrail } from "@/src/security/audit/audit_trail";

export interface TriggerRunResult {
  readonly triggerId: string;
  readonly triggerName: string;
  readonly agentId: string;
  readonly status: "completed" | "failed" | "skipped";
  readonly runId: string | null;
  readonly error: string | null;
  readonly durationMs: number | null;
}

export interface TriggerRunnerSummary {
  readonly processed: number;
  readonly completed: number;
  readonly failed: number;
  readonly results: readonly TriggerRunResult[];
}

async function executeTrigger(trigger: AgentTriggerDefinition): Promise<TriggerRunResult> {
  const scheduledFor = trigger.nextRunAt ? new Date(trigger.nextRunAt) : new Date();
  const execution = await recordTriggerExecutionStart({
    triggerId: trigger.id,
    scheduledFor,
  });
  const startedAt = Date.now();
  try {
    const run = await executionEngine.execute({
      workflowId: trigger.agentId,
      triggerType: "ScheduleTrigger",
      input: trigger.input,
      isSimulation: false,
    });
    auditTrail.record("run.started", "system", "run", run.id, {
      workflowId: run.workflowId,
      triggerId: trigger.id,
      triggerType: "ScheduleTrigger",
    });
    const status = run.status === "completed" ? "completed" : "failed";
    if (status === "completed") {
      auditTrail.record("run.completed", "system", "run", run.id, { triggerId: trigger.id });
    } else {
      auditTrail.record("run.failed", "system", "run", run.id, {
        triggerId: trigger.id,
        error: run.error,
      });
    }
    await recordTriggerExecutionFinish({
      executionId: execution.id,
      triggerId: trigger.id,
      runId: run.id,
      status,
      error: run.error ?? null,
    });
    return {
      triggerId: trigger.id,
      triggerName: trigger.name,
      agentId: trigger.agentId,
      status,
      runId: run.id,
      error: run.error ?? null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed";
    await recordTriggerExecutionFinish({
      executionId: execution.id,
      triggerId: trigger.id,
      runId: null,
      status: "failed",
      error: message,
    });
    return {
      triggerId: trigger.id,
      triggerName: trigger.name,
      agentId: trigger.agentId,
      status: "failed",
      runId: null,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

export async function runDueTriggers(): Promise<TriggerRunnerSummary> {
  const dueTriggers = await listDueTriggers();
  const results: TriggerRunResult[] = [];
  for (const trigger of dueTriggers) {
    results.push(await executeTrigger(trigger));
  }
  return {
    processed: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}
