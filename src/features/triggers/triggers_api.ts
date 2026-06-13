import type {
  AgentTriggerDefinition,
  CreateTriggerInput,
  TriggerExecutionRecord,
  TriggersPageData,
  TriggersPageMetrics,
  TriggerScheduleType,
  UpdateTriggerInput,
} from "@/src/core/triggers/types";
import type { WorkflowDefinition } from "@/src/core/workflow/types";

export type {
  AgentTriggerDefinition,
  CreateTriggerInput,
  TriggerExecutionRecord,
  TriggersPageData,
  TriggersPageMetrics,
  TriggerScheduleType,
  UpdateTriggerInput,
};

export async function fetchTriggersPageData(): Promise<TriggersPageData> {
  const response = await fetch("/api/triggers");
  if (!response.ok) {
    throw new Error("Failed to load triggers");
  }
  return response.json() as Promise<TriggersPageData>;
}

export async function fetchAgents(): Promise<readonly WorkflowDefinition[]> {
  const response = await fetch("/api/workflows");
  if (!response.ok) {
    throw new Error("Failed to load agents");
  }
  const data = await response.json();
  return data.workflows as readonly WorkflowDefinition[];
}

export async function createTrigger(input: CreateTriggerInput): Promise<AgentTriggerDefinition> {
  const response = await fetch("/api/triggers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to create trigger");
  }
  return data.trigger as AgentTriggerDefinition;
}

export async function updateTrigger(
  id: string,
  input: UpdateTriggerInput,
): Promise<AgentTriggerDefinition> {
  const response = await fetch(`/api/triggers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to update trigger");
  }
  return data.trigger as AgentTriggerDefinition;
}

export async function deleteTrigger(id: string): Promise<void> {
  const response = await fetch(`/api/triggers/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "Failed to delete trigger");
  }
}

export async function runTriggersNow(): Promise<{ processed: number; completed: number; failed: number }> {
  const response = await fetch("/api/cron/run-triggers", { method: "POST" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to run triggers");
  }
  return data.summary as { processed: number; completed: number; failed: number };
}
