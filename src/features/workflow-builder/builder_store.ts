import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { EdgeDefinition, NodeDefinition, WorkflowDefinition } from "@/src/core/workflow/types";
import type { Run } from "@/src/core/execution/types";

export interface NodePluginSummary {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly category: string;
  readonly icon: string;
  readonly color: string;
  readonly inputPorts: readonly { readonly id: string; readonly label: string; readonly dataType: string }[];
  readonly outputPorts: readonly { readonly id: string; readonly label: string; readonly dataType: string }[];
  readonly configFields: readonly {
    readonly key: string;
    readonly label: string;
    readonly type: string;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
    readonly options?: readonly { readonly label: string; readonly value: string }[];
    readonly placeholder?: string;
  }[];
  readonly defaultConfig: Record<string, unknown>;
  readonly isMutating: boolean;
}

interface BuilderState {
  workflow: WorkflowDefinition | null;
  plugins: NodePluginSummary[];
  selectedNodeId: string | null;
  activeRun: Run | null;
  runs: Run[];
  isLoading: boolean;
  isSaving: boolean;
  isRunning: boolean;
  isSimulation: boolean;
  validationIssues: readonly { code: string; message: string; nodeId?: string }[];
  setWorkflow: (workflow: WorkflowDefinition | null) => void;
  setPlugins: (plugins: NodePluginSummary[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setActiveRun: (run: Run | null) => void;
  setRuns: (runs: Run[]) => void;
  setIsSimulation: (value: boolean) => void;
  setValidationIssues: (issues: readonly { code: string; message: string; nodeId?: string }[]) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodes: (nodes: NodeDefinition[]) => void;
  updateEdges: (edges: EdgeDefinition[]) => void;
  removeNode: (nodeId: string) => void;
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  workflow: null,
  plugins: [],
  selectedNodeId: null,
  activeRun: null,
  runs: [],
  isLoading: false,
  isSaving: false,
  isRunning: false,
  isSimulation: false,
  validationIssues: [],
  setWorkflow: (workflow) => set({ workflow }),
  setPlugins: (plugins) => set({ plugins }),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setActiveRun: (run) => set({ activeRun: run }),
  setRuns: (runs) => set({ runs }),
  setIsSimulation: (value) => set({ isSimulation: value }),
  setValidationIssues: (issues) => set({ validationIssues: issues }),
  addNode: (type, position) => {
    const { workflow, plugins } = get();
    if (!workflow) {
      return;
    }
    const plugin = plugins.find((p) => p.type === type);
    if (!plugin) {
      return;
    }
    const newNode: NodeDefinition = {
      id: uuidv4(),
      type,
      label: plugin.label,
      position,
      config: { ...plugin.defaultConfig },
    };
    set({
      workflow: {
        ...workflow,
        nodes: [...workflow.nodes, newNode],
      },
      selectedNodeId: newNode.id,
    });
  },
  updateNodeConfig: (nodeId, config) => {
    const { workflow } = get();
    if (!workflow) {
      return;
    }
    set({
      workflow: {
        ...workflow,
        nodes: workflow.nodes.map((node) =>
          node.id === nodeId ? { ...node, config: { ...node.config, ...config } } : node,
        ),
      },
    });
  },
  updateNodeLabel: (nodeId, label) => {
    const { workflow } = get();
    if (!workflow) {
      return;
    }
    set({
      workflow: {
        ...workflow,
        nodes: workflow.nodes.map((node) => (node.id === nodeId ? { ...node, label } : node)),
      },
    });
  },
  updateNodes: (nodes) => {
    const { workflow } = get();
    if (!workflow) {
      return;
    }
    set({ workflow: { ...workflow, nodes } });
  },
  updateEdges: (edges) => {
    const { workflow } = get();
    if (!workflow) {
      return;
    }
    set({ workflow: { ...workflow, edges } });
  },
  removeNode: (nodeId) => {
    const { workflow } = get();
    if (!workflow) {
      return;
    }
    set({
      workflow: {
        ...workflow,
        nodes: workflow.nodes.filter((node) => node.id !== nodeId),
        edges: workflow.edges.filter(
          (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
        ),
      },
      selectedNodeId: null,
    });
  },
}));

export async function fetchWorkflows(): Promise<WorkflowDefinition[]> {
  const response = await fetch("/api/workflows");
  const data = await response.json();
  return data.workflows ?? [];
}

export async function createWorkflow(input: {
  name: string;
  description?: string;
  environment?: WorkflowDefinition["environment"];
}): Promise<WorkflowDefinition> {
  const response = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to create agent");
  }
  return data.workflow;
}

export async function fetchWorkflow(id: string): Promise<{ workflow: WorkflowDefinition; validation: { isValid: boolean; issues: readonly { code: string; message: string }[] } }> {
  const response = await fetch(`/api/workflows/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Workflow not found");
  }
  return data;
}

export async function saveWorkflow(workflow: WorkflowDefinition): Promise<{ workflow: WorkflowDefinition; validation: { isValid: boolean; issues: readonly { code: string; message: string }[] } }> {
  const response = await fetch(`/api/workflows/${workflow.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      edges: workflow.edges,
      environment: workflow.environment,
      status: workflow.status,
    }),
  });
  return response.json();
}

export async function executeWorkflow(
  workflowId: string,
  input: Record<string, unknown>,
  isSimulation: boolean,
): Promise<Run> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId, input, isSimulation }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Execution failed");
  }
  return data.run;
}

export async function approveRun(runId: string, approvalId: string, approved: boolean): Promise<Run> {
  const response = await fetch(`/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalId, approved }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Approval failed");
  }
  return data.run;
}

export async function fetchPlugins(): Promise<NodePluginSummary[]> {
  const response = await fetch("/api/nodes");
  const data = await response.json();
  return data.plugins ?? [];
}

export async function fetchRuns(workflowId: string): Promise<Run[]> {
  const response = await fetch(`/api/runs?workflowId=${workflowId}`);
  const data = await response.json();
  return data.runs ?? [];
}
