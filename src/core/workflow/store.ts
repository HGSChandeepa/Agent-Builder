import { v4 as uuidv4 } from "uuid";
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowDefinition,
} from "@/src/core/workflow/types";

class WorkflowStore {
  private workflows = new Map<string, WorkflowDefinition>();

  create(input: CreateWorkflowInput): WorkflowDefinition {
    const now = new Date().toISOString();
    const workflow: WorkflowDefinition = {
      id: uuidv4(),
      name: input.name,
      description: input.description ?? "",
      version: 1,
      environment: input.environment ?? "development",
      status: "draft",
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  getAll(): readonly WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  update(id: string, input: UpdateWorkflowInput): WorkflowDefinition | undefined {
    const existing = this.workflows.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: WorkflowDefinition = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      nodes: input.nodes ?? existing.nodes,
      edges: input.edges ?? existing.edges,
      status: input.status ?? existing.status,
      environment: input.environment ?? existing.environment,
      version: input.nodes || input.edges ? existing.version + 1 : existing.version,
      updatedAt: new Date().toISOString(),
    };
    this.workflows.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.workflows.delete(id);
  }
}

export const workflowStore = new WorkflowStore();

export function seedDefaultWorkflow(): WorkflowDefinition {
  const existing = workflowStore.getAll();
  if (existing.length > 0) {
    return existing[0];
  }
  const workflow = workflowStore.create({
    name: "Customer Support Agent",
    description: "Sample agent workflow with approval gates and policy checks",
  });
  const triggerId = uuidv4();
  const policyId = uuidv4();
  const promptId = uuidv4();
  const llmId = uuidv4();
  const llmOutputId = uuidv4();
  const approvalId = uuidv4();
  const responseId = uuidv4();
  return workflowStore.update(workflow.id, {
    nodes: [
      { id: triggerId, type: "ManualTrigger", label: "Start", position: { x: 80, y: 200 }, config: {} },
      { id: policyId, type: "PolicyCheck", label: "Policy Check", position: { x: 320, y: 200 }, config: { blockPii: true } },
      { id: promptId, type: "PromptTemplate", label: "Build Prompt", position: { x: 560, y: 200 }, config: { systemPrompt: "You are a concise customer support assistant.", userPrompt: "Help the customer with: {{message}}" } },
      { id: llmId, type: "LlmCall", label: "Generate Response", position: { x: 800, y: 200 }, config: { model: "openai/gpt-oss-120b", reasoningEffort: "medium", temperature: 1, maxTokens: 1024, outputFormat: "text", structuredFields: [] } },
      { id: llmOutputId, type: "LlmOutput", label: "LLM Output", position: { x: 1040, y: 80 }, config: {} },
      { id: approvalId, type: "ApprovalGate", label: "Review Response", position: { x: 1040, y: 200 }, config: { actionLabel: "Approve AI Response" } },
      { id: responseId, type: "ReturnResponse", label: "Return", position: { x: 1280, y: 200 }, config: { statusCode: 200 } },
    ],
    edges: [
      { id: uuidv4(), sourceNodeId: triggerId, sourcePortId: "output", targetNodeId: policyId, targetPortId: "input" },
      { id: uuidv4(), sourceNodeId: policyId, sourcePortId: "pass", targetNodeId: promptId, targetPortId: "input" },
      { id: uuidv4(), sourceNodeId: promptId, sourcePortId: "output", targetNodeId: llmId, targetPortId: "input" },
      { id: uuidv4(), sourceNodeId: llmId, sourcePortId: "output", targetNodeId: llmOutputId, targetPortId: "input" },
      { id: uuidv4(), sourceNodeId: llmId, sourcePortId: "output", targetNodeId: approvalId, targetPortId: "input" },
      { id: uuidv4(), sourceNodeId: approvalId, sourcePortId: "output", targetNodeId: responseId, targetPortId: "input" },
    ],
  })!;
}
