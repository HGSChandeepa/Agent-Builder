"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useBuilderStore } from "@/src/features/workflow-builder/builder_store";

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  color: string;
  category: string;
  isMutating: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  trigger: "Trigger",
  input: "Input",
  data: "Data",
  ai: "AI",
  control: "Flow",
  action: "Action",
  governance: "Safety",
  output: "Output",
};

const DEFAULT_INPUT = [{ id: "input", label: "Input" }];
const DEFAULT_OUTPUT = [{ id: "output", label: "Output" }];

function getHandleTop(index: number, total: number): string {
  if (total <= 1) {
    return "50%";
  }
  const step = 60 / (total + 1);
  return `${20 + step * (index + 1)}%`;
}

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const plugin = useBuilderStore((state) => state.plugins.find((p) => p.type === nodeData.nodeType));
  const isTrigger = nodeData.category === "trigger";
  const inputPorts =
    plugin?.inputPorts !== undefined ? [...plugin.inputPorts] : isTrigger ? [] : DEFAULT_INPUT;
  const outputPorts = plugin?.outputPorts !== undefined ? [...plugin.outputPorts] : DEFAULT_OUTPUT;
  return (
    <div
      className={`relative min-w-[188px] max-w-[232px] overflow-visible rounded-xl border bg-background shadow-sm transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/35"
      }`}
      style={{ borderTopWidth: 3, borderTopColor: nodeData.color }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className="flex size-5 items-center justify-center rounded text-[9px] font-bold text-white"
            style={{ backgroundColor: nodeData.color }}
          >
            {nodeData.label.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[nodeData.category] ?? nodeData.category}
          </span>
          {nodeData.isMutating && (
            <span className="rounded bg-amber-500/10 px-1 py-px text-[9px] font-medium text-amber-700">
              Write
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[13px] font-medium text-foreground">{nodeData.label}</div>
      </div>
      {inputPorts.map((port, index) => (
        <Handle
          key={`in-${port.id}`}
          id={port.id}
          type="target"
          position={Position.Left}
          isConnectable
          style={{ top: getHandleTop(index, inputPorts.length) }}
          className="!bg-[var(--handle-target)]"
        />
      ))}
      {outputPorts.map((port, index) => (
        <Handle
          key={`out-${port.id}`}
          id={port.id}
          type="source"
          position={Position.Right}
          isConnectable
          style={{ top: getHandleTop(index, outputPorts.length) }}
          className="!bg-[var(--handle-source)]"
        />
      ))}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
