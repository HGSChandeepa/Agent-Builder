import type {
  AgentEnvironment,
  AgentStatus,
  Agent as PrismaAgent,
  Prisma,
} from "@/generated/prisma/client";
import type {
  AgentIntegrationsConfig,
  CreateWorkflowInput,
  EdgeDefinition,
  NodeDefinition,
  UpdateWorkflowInput,
  WorkflowDefinition,
  WorkflowEnvironment,
  WorkflowStatus,
} from "@/src/core/workflow/types";
import { prisma } from "@/src/lib/prisma";

function toWorkflowEnvironment(environment: AgentEnvironment): WorkflowEnvironment {
  return environment;
}

function toWorkflowStatus(status: AgentStatus): WorkflowStatus {
  return status;
}

function parseNodes(value: PrismaAgent["nodes"]): readonly NodeDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as NodeDefinition[];
}

function parseEdges(value: PrismaAgent["edges"]): readonly EdgeDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as unknown as EdgeDefinition[];
}

function toInputJsonValue<T>(value: readonly T[] | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseIntegrations(value: PrismaAgent["integrations"]): AgentIntegrationsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as AgentIntegrationsConfig;
}

function toWorkflowDefinition(agent: PrismaAgent): WorkflowDefinition {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    version: agent.version,
    environment: toWorkflowEnvironment(agent.environment),
    status: toWorkflowStatus(agent.status),
    nodes: parseNodes(agent.nodes),
    edges: parseEdges(agent.edges),
    integrations: parseIntegrations(agent.integrations),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export async function createAgent(input: CreateWorkflowInput): Promise<WorkflowDefinition> {
  const agent = await prisma.agent.create({
    data: {
      name: input.name,
      description: input.description ?? "",
      environment: input.environment ?? "development",
      integrations: (input.integrations ?? {}) as Prisma.InputJsonValue,
    },
  });
  return toWorkflowDefinition(agent);
}

export async function getAgent(id: string): Promise<WorkflowDefinition | null> {
  const agent = await prisma.agent.findUnique({ where: { id } });
  return agent ? toWorkflowDefinition(agent) : null;
}

export async function listAgents(): Promise<readonly WorkflowDefinition[]> {
  const agents = await prisma.agent.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return agents.map(toWorkflowDefinition);
}

export async function updateAgent(
  id: string,
  input: UpdateWorkflowInput,
): Promise<WorkflowDefinition | null> {
  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const hasGraphChanges = input.nodes !== undefined || input.edges !== undefined;
  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      environment: input.environment,
      status: input.status,
      nodes: toInputJsonValue(input.nodes),
      edges: toInputJsonValue(input.edges),
      integrations: input.integrations
        ? (input.integrations as Prisma.InputJsonValue)
        : undefined,
      version: hasGraphChanges ? existing.version + 1 : undefined,
    },
  });
  return toWorkflowDefinition(agent);
}

export async function deleteAgent(id: string): Promise<boolean> {
  try {
    await prisma.agent.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
