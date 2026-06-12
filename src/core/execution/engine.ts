import { v4 as uuidv4 } from "uuid";
import type {
  ApprovalRequest,
  ExecuteWorkflowInput,
  ExecutionContext,
  Run,
  RunMetric,
  RunTraceSpan,
  StepLogEntry,
  StepRun,
} from "@/src/core/execution/types";
import { policyEngine } from "@/src/security/policy/policy_engine";
import { auditTrail } from "@/src/security/audit/audit_trail";
import type { NodePluginRegistry } from "@/src/core/nodes/types";
import { getTopologicalOrder } from "@/src/core/workflow/validator";
import type { EdgeDefinition } from "@/src/core/workflow/types";
import { getAgent } from "@/src/core/workflow/repository";
import { executeWithRetry, mergeRetryPolicy } from "@/src/core/execution/retry";
import type { RetryPolicy } from "@/src/core/execution/retry";
import { prisma } from "@/src/lib/prisma";
import type { Prisma, WorkflowRun as PrismaWorkflowRun } from "@/generated/prisma/client";

const LLM_REQUIRES_PROMPT_TEMPLATE_MESSAGE =
  "LLM Call needs a Prompt Template connected directly before it. Add a Prompt Template block and connect its output to the LLM Call input.";

class RunStore {
  async save(run: Run): Promise<Run> {
    await prisma.workflowRun.upsert({
      where: { id: run.id },
      create: this.toPersistenceInput(run),
      update: this.toPersistenceInput(run),
    });
    return run;
  }

  async get(id: string): Promise<Run | undefined> {
    const run = await prisma.workflowRun.findUnique({ where: { id } });
    return run ? this.toRun(run) : undefined;
  }

  async getByWorkflow(workflowId: string): Promise<readonly Run[]> {
    const runs = await prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: "desc" },
    });
    return runs.map((run) => this.toRun(run));
  }

  async getAll(): Promise<readonly Run[]> {
    const runs = await prisma.workflowRun.findMany({
      orderBy: { startedAt: "desc" },
    });
    return runs.map((run) => this.toRun(run));
  }

  private toPersistenceInput(run: Run): Prisma.WorkflowRunUncheckedCreateInput {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: run.status,
      triggerType: run.triggerType,
      isSimulation: run.isSimulation,
      input: toInputJsonValue(run.input),
      output: toInputJsonValue(run.output),
      stepRuns: toInputJsonValue(run.stepRuns),
      metrics: toInputJsonValue(run.metrics),
      traces: toInputJsonValue(run.traces),
      approvalRequests: toInputJsonValue(run.approvalRequests),
      error: run.error,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    };
  }

  private toRun(run: PrismaWorkflowRun): Run {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: run.status as Run["status"],
      triggerType: run.triggerType,
      isSimulation: run.isSimulation,
      input: toRecord(run.input),
      output: toRecord(run.output),
      stepRuns: toArray(run.stepRuns) as unknown as StepRun[],
      metrics: toArray(run.metrics) as unknown as RunMetric[],
      traces: toArray(run.traces) as unknown as RunTraceSpan[],
      approvalRequests: toArray(run.approvalRequests) as unknown as ApprovalRequest[],
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      error: run.error ?? undefined,
    };
  }
}

export const runStore = new RunStore();

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toArray(value: Prisma.JsonValue): unknown[] {
  return Array.isArray(value) ? value : [];
}

interface MutableRun {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: Run["status"];
  triggerType: string;
  isSimulation: boolean;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  stepRuns: StepRun[];
  metrics: RunMetric[];
  traces: RunTraceSpan[];
  approvalRequests: ApprovalRequest[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

function createStepRun(runId: string, nodeId: string, nodeType: string): StepRun {
  return {
    id: uuidv4(),
    runId,
    nodeId,
    nodeType,
    status: "pending",
    attempt: 0,
    input: {},
    output: {},
    logs: [],
  };
}

function appendLog(step: StepRun, level: StepLogEntry["level"], message: string): StepRun {
  return {
    ...step,
    logs: [...step.logs, { timestamp: new Date().toISOString(), level, message }],
  };
}

export class ExecutionEngine {
  constructor(private readonly registry: NodePluginRegistry) {}

  async execute(input: ExecuteWorkflowInput): Promise<Run> {
    const workflow = await getAgent(input.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${input.workflowId}`);
    }
    const runId = uuidv4();
    const startedAt = new Date().toISOString();
    const mutableRun: MutableRun = {
      id: runId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: "running",
      triggerType: input.triggerType ?? "ManualTrigger",
      isSimulation: input.isSimulation ?? false,
      input: input.input ?? {},
      output: {},
      stepRuns: [],
      metrics: [],
      traces: [],
      approvalRequests: [],
      startedAt,
    };
    await runStore.save(mutableRun);
    let context: ExecutionContext = {
      runId,
      workflowId: workflow.id,
      isSimulation: mutableRun.isSimulation,
      environment: workflow.environment,
      variables: { ...mutableRun.input },
    };
    const nodeOutputs = new Map<string, Record<string, unknown>>();
    const order = getTopologicalOrder(workflow.nodes, workflow.edges);
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const incomingEdges = new Map<string, EdgeDefinition[]>();
    for (const node of workflow.nodes) {
      incomingEdges.set(node.id, []);
    }
    for (const edge of workflow.edges) {
      const edges = incomingEdges.get(edge.targetNodeId) ?? [];
      edges.push(edge);
      incomingEdges.set(edge.targetNodeId, edges);
    }
    let retryPolicy: RetryPolicy = { maxRetries: 0, baseDelayMs: 1000 };
    try {
      for (const nodeId of order) {
        const node = nodeMap.get(nodeId);
        if (!node) {
          continue;
        }
        const plugin = this.registry.get(node.type);
        if (!plugin) {
          throw new Error(`Unknown node type: ${node.type}`);
        }
        const edges = incomingEdges.get(nodeId) ?? [];
        const nodeInput: Record<string, unknown> = {};
        for (const edge of edges) {
          const sourceOutput = nodeOutputs.get(edge.sourceNodeId);
          if (sourceOutput) {
            Object.assign(nodeInput, sourceOutput);
          }
        }
        if (Object.keys(nodeInput).length === 0) {
          Object.assign(nodeInput, context.variables);
        }
        let step = createStepRun(runId, nodeId, node.type);
        step = { ...step, status: "running", attempt: 1, input: nodeInput, startedAt: new Date().toISOString() };
        mutableRun.stepRuns.push(step);
        const traceId = uuidv4();
        mutableRun.traces.push({
          id: traceId,
          nodeId,
          name: plugin.label,
          startTime: new Date().toISOString(),
          status: "ok",
        });
        if (node.type === "RetryWithBackoff") {
          retryPolicy = mergeRetryPolicy({ ...node.config, ...nodeInput }, retryPolicy);
        }
        if (node.type === "LlmCall") {
          const hasPromptTemplateInput = edges.some((edge) => {
            return nodeMap.get(edge.sourceNodeId)?.type === "PromptTemplate";
          });
          if (!hasPromptTemplateInput) {
            throw new Error(LLM_REQUIRES_PROMPT_TEMPLATE_MESSAGE);
          }
        }
        const executeNode = async () => {
          const policyResult = policyEngine.evaluate({
            payload: nodeInput,
            environment: workflow.environment,
            isMutating: plugin.isMutating ?? false,
            isSimulation: mutableRun.isSimulation,
          });
          if (!policyResult.passed) {
            auditTrail.record("policy.violation", "system", "run", runId, {
              nodeId,
              violations: policyResult.violations,
            });
            throw new Error(`Policy check failed: ${policyResult.violations.map((v) => v.message).join(", ")}`);
          }
          return plugin.execute({
            nodeId,
            config: node.config,
            inputs: nodeInput,
            context,
          });
        };
        const { result: executionResult, attempts } = await executeWithRetry(executeNode, retryPolicy);
        step = { ...step, attempt: attempts };
        for (const log of executionResult.logs ?? []) {
          step = appendLog(step, log.level, log.message);
        }
        if (executionResult.metrics) {
          for (const metric of executionResult.metrics) {
            mutableRun.metrics.push({
              name: metric.name,
              value: metric.value,
              unit: metric.unit,
              timestamp: new Date().toISOString(),
            });
          }
        }
        if (executionResult.requiresApproval) {
          const approval: ApprovalRequest = {
            id: uuidv4(),
            runId,
            stepRunId: step.id,
            nodeId,
            action: plugin.label,
            payload: executionResult.approvalPayload ?? nodeInput,
            status: "pending",
            requestedAt: new Date().toISOString(),
          };
          mutableRun.approvalRequests.push(approval);
          step = { ...step, status: "waiting_approval", output: executionResult.output };
          mutableRun.status = "waiting_approval";
          const traceIndex = mutableRun.traces.findIndex((t) => t.id === traceId);
          if (traceIndex >= 0) {
            mutableRun.traces[traceIndex] = {
              ...mutableRun.traces[traceIndex],
              endTime: new Date().toISOString(),
            };
          }
          mutableRun.stepRuns[mutableRun.stepRuns.length - 1] = step;
          await runStore.save(mutableRun);
          return mutableRun;
        }
        const completedAt = new Date().toISOString();
        const durationMs = step.startedAt
          ? new Date(completedAt).getTime() - new Date(step.startedAt).getTime()
          : 0;
        step = {
          ...step,
          status: "completed",
          output: executionResult.output,
          completedAt,
          durationMs,
        };
        mutableRun.stepRuns[mutableRun.stepRuns.length - 1] = step;
        nodeOutputs.set(nodeId, executionResult.output);
        context = { ...context, variables: { ...context.variables, ...executionResult.output } };
        const traceIndex = mutableRun.traces.findIndex((t) => t.id === traceId);
        if (traceIndex >= 0) {
          mutableRun.traces[traceIndex] = {
            ...mutableRun.traces[traceIndex],
            endTime: completedAt,
          };
        }
        if (executionResult.output.isFinal) {
          mutableRun.output = executionResult.output;
        }
      }
      mutableRun.status = "completed";
      mutableRun.completedAt = new Date().toISOString();
    } catch (err) {
      mutableRun.status = "failed";
      mutableRun.error = err instanceof Error ? err.message : String(err);
      mutableRun.completedAt = new Date().toISOString();
      const lastStep = mutableRun.stepRuns[mutableRun.stepRuns.length - 1];
      if (lastStep) {
        mutableRun.stepRuns[mutableRun.stepRuns.length - 1] = {
          ...lastStep,
          status: "failed",
          error: mutableRun.error,
          completedAt: new Date().toISOString(),
        };
      }
    }
    await runStore.save(mutableRun);
    return mutableRun;
  }

  async resumeAfterApproval(runId: string, approvalId: string, approved: boolean, resolvedBy?: string): Promise<Run> {
    const run = await runStore.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    if (run.status !== "waiting_approval") {
      throw new Error("Run is not waiting for approval");
    }
    const approvalIndex = run.approvalRequests.findIndex((a) => a.id === approvalId);
    if (approvalIndex < 0) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    const mutableRun = { ...run, approvalRequests: [...run.approvalRequests], stepRuns: [...run.stepRuns] } as MutableRun;
    mutableRun.approvalRequests[approvalIndex] = {
      ...mutableRun.approvalRequests[approvalIndex],
      status: approved ? "approved" : "rejected",
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    };
    if (!approved) {
      mutableRun.status = "cancelled";
      mutableRun.completedAt = new Date().toISOString();
      await runStore.save(mutableRun);
      return mutableRun;
    }
    const workflow = await getAgent(run.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }
    const pendingStep = mutableRun.stepRuns.find((s) => s.status === "waiting_approval");
    if (pendingStep) {
      const stepIndex = mutableRun.stepRuns.findIndex((s) => s.id === pendingStep.id);
      mutableRun.stepRuns[stepIndex] = {
        ...pendingStep,
        status: "completed",
        completedAt: new Date().toISOString(),
        output: { ...pendingStep.output, approved: true },
      };
    }
    mutableRun.status = "running";
    await runStore.save(mutableRun);
    const order = getTopologicalOrder(workflow.nodes, workflow.edges);
    const resumeIndex = pendingStep ? order.indexOf(pendingStep.nodeId) + 1 : 0;
    const remainingNodes = order.slice(resumeIndex);
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const nodeOutputs = new Map<string, Record<string, unknown>>();
    for (const step of mutableRun.stepRuns) {
      if (step.status === "completed") {
        nodeOutputs.set(step.nodeId, step.output);
      }
    }
    const context: ExecutionContext = {
      runId: run.id,
      workflowId: workflow.id,
      isSimulation: run.isSimulation,
      environment: workflow.environment,
      variables: { ...run.input, ...Object.fromEntries(nodeOutputs) },
    };
    try {
      for (const nodeId of remainingNodes) {
        const node = nodeMap.get(nodeId);
        if (!node) {
          continue;
        }
        const plugin = this.registry.get(node.type);
        if (!plugin) {
          continue;
        }
        const nodeInput = nodeOutputs.get(nodeId) ?? context.variables;
        let step = createStepRun(run.id, nodeId, node.type);
        step = { ...step, status: "running", input: nodeInput as Record<string, unknown>, startedAt: new Date().toISOString() };
        const result = await plugin.execute({ nodeId, config: node.config, inputs: nodeInput as Record<string, unknown>, context });
        step = { ...step, status: "completed", output: result.output, completedAt: new Date().toISOString() };
        mutableRun.stepRuns.push(step);
        nodeOutputs.set(nodeId, result.output);
        if (result.output.isFinal) {
          mutableRun.output = result.output;
        }
      }
      mutableRun.status = "completed";
      mutableRun.completedAt = new Date().toISOString();
    } catch (err) {
      mutableRun.status = "failed";
      mutableRun.error = err instanceof Error ? err.message : String(err);
    }
    await runStore.save(mutableRun);
    return mutableRun;
  }
}

export function createExecutionEngine(registry: NodePluginRegistry): ExecutionEngine {
  return new ExecutionEngine(registry);
}
