import type { PortDefinition } from "@/src/core/workflow/types";
import type { ExecutionContext } from "@/src/core/execution/types";

export type NodeCategory =
  | "trigger"
  | "input"
  | "data"
  | "ai"
  | "control"
  | "action"
  | "governance"
  | "output";

export interface NodeConfigField {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "textarea" | "number" | "boolean" | "select" | "json";
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly options?: readonly { readonly label: string; readonly value: string }[];
  readonly placeholder?: string;
}

export interface NodeExecutionInput {
  readonly nodeId: string;
  readonly config: Record<string, unknown>;
  readonly inputs: Record<string, unknown>;
  readonly context: ExecutionContext;
}

export interface NodeExecutionResult {
  readonly output: Record<string, unknown>;
  readonly branch?: string;
  readonly requiresApproval?: boolean;
  readonly approvalPayload?: Record<string, unknown>;
  readonly logs?: readonly { readonly level: "debug" | "info" | "warn" | "error"; readonly message: string }[];
  readonly metrics?: readonly { readonly name: string; readonly value: number; readonly unit?: string }[];
}

export interface NodePlugin {
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly category: NodeCategory;
  readonly icon: string;
  readonly color: string;
  readonly inputPorts: readonly PortDefinition[];
  readonly outputPorts: readonly PortDefinition[];
  readonly configFields: readonly NodeConfigField[];
  readonly defaultConfig: Record<string, unknown>;
  readonly isMutating?: boolean;
  readonly execute: (input: NodeExecutionInput) => Promise<NodeExecutionResult>;
}

export interface NodePluginRegistry {
  register: (plugin: NodePlugin) => void;
  get: (type: string) => NodePlugin | undefined;
  getAll: () => readonly NodePlugin[];
  getByCategory: (category: NodeCategory) => readonly NodePlugin[];
}
