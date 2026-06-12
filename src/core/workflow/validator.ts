import type {
  EdgeDefinition,
  NodeDefinition,
  ValidationIssue,
  ValidationResult,
  WorkflowDefinition,
} from "@/src/core/workflow/types";
import type { NodePluginRegistry } from "@/src/core/nodes/types";

function buildAdjacencyList(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.sourceNodeId) ?? [];
    neighbors.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, neighbors);
  }
  return adjacency;
}

function detectCycle(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
): ValidationIssue[] {
  const adjacency = buildAdjacencyList(nodes, edges);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const issues: ValidationIssue[] = [];
  function visit(nodeId: string): boolean {
    if (stack.has(nodeId)) {
      issues.push({
        code: "CYCLE_DETECTED",
        message: "Workflow contains a cycle which is not allowed",
        nodeId,
      });
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    stack.add(nodeId);
    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (visit(neighbor)) {
        return true;
      }
    }
    stack.delete(nodeId);
    return false;
  }
  for (const node of nodes) {
    visit(node.id);
    if (issues.length > 0) {
      break;
    }
  }
  return issues;
}

function validateTriggerNodes(
  nodes: readonly NodeDefinition[],
  registry: NodePluginRegistry,
): ValidationIssue[] {
  const triggerNodes = nodes.filter((node) => {
    const plugin = registry.get(node.type);
    return plugin?.category === "trigger";
  });
  if (triggerNodes.length === 0) {
    return [
      {
        code: "NO_TRIGGER",
        message: "Workflow must contain at least one trigger node",
      },
    ];
  }
  return [];
}

function validateEdges(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
  registry: NodePluginRegistry,
): ValidationIssue[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const issues: ValidationIssue[] = [];
  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.sourceNodeId);
    const targetNode = nodeMap.get(edge.targetNodeId);
    if (!sourceNode) {
      issues.push({
        code: "INVALID_EDGE_SOURCE",
        message: `Edge references unknown source node: ${edge.sourceNodeId}`,
        edgeId: edge.id,
      });
      continue;
    }
    if (!targetNode) {
      issues.push({
        code: "INVALID_EDGE_TARGET",
        message: `Edge references unknown target node: ${edge.targetNodeId}`,
        edgeId: edge.id,
      });
      continue;
    }
    const sourcePlugin = registry.get(sourceNode.type);
    const targetPlugin = registry.get(targetNode.type);
    if (!sourcePlugin) {
      issues.push({
        code: "UNKNOWN_NODE_TYPE",
        message: `Unknown node type: ${sourceNode.type}`,
        nodeId: sourceNode.id,
      });
      continue;
    }
    if (!targetPlugin) {
      issues.push({
        code: "UNKNOWN_NODE_TYPE",
        message: `Unknown node type: ${targetNode.type}`,
        nodeId: targetNode.id,
      });
      continue;
    }
    const sourcePort = sourcePlugin.outputPorts.find((port) => port.id === edge.sourcePortId);
    const targetPort = targetPlugin.inputPorts.find((port) => port.id === edge.targetPortId);
    if (!sourcePort) {
      issues.push({
        code: "INVALID_SOURCE_PORT",
        message: `Invalid source port: ${edge.sourcePortId}`,
        edgeId: edge.id,
        nodeId: sourceNode.id,
      });
    }
    if (!targetPort) {
      issues.push({
        code: "INVALID_TARGET_PORT",
        message: `Invalid target port: ${edge.targetPortId}`,
        edgeId: edge.id,
        nodeId: targetNode.id,
      });
    }
  }
  return issues;
}

function validateOrphanNodes(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
  registry: NodePluginRegistry,
): ValidationIssue[] {
  const connected = new Set<string>();
  for (const edge of edges) {
    connected.add(edge.sourceNodeId);
    connected.add(edge.targetNodeId);
  }
  const issues: ValidationIssue[] = [];
  for (const node of nodes) {
    const plugin = registry.get(node.type);
    if (plugin?.category === "trigger") {
      continue;
    }
    if (!connected.has(node.id)) {
      issues.push({
        code: "ORPHAN_NODE",
        message: `Node "${node.label}" is not connected to the workflow`,
        nodeId: node.id,
      });
    }
  }
  return issues;
}

function validateLlmPromptTemplateLinks(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
): ValidationIssue[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const issues: ValidationIssue[] = [];
  for (const node of nodes) {
    if (node.type !== "LlmCall") {
      continue;
    }
    const hasPromptTemplateInput = edges.some((edge) => {
      return edge.targetNodeId === node.id && nodeMap.get(edge.sourceNodeId)?.type === "PromptTemplate";
    });
    if (!hasPromptTemplateInput) {
      issues.push({
        code: "LLM_REQUIRES_PROMPT_TEMPLATE",
        message: "LLM Call needs a Prompt Template connected directly before it.",
        nodeId: node.id,
      });
    }
  }
  return issues;
}

export function validateWorkflow(
  workflow: WorkflowDefinition,
  registry: NodePluginRegistry,
): ValidationResult {
  const issues: ValidationIssue[] = [
    ...validateTriggerNodes(workflow.nodes, registry),
    ...validateEdges(workflow.nodes, workflow.edges, registry),
    ...detectCycle(workflow.nodes, workflow.edges),
    ...validateOrphanNodes(workflow.nodes, workflow.edges, registry),
    ...validateLlmPromptTemplateLinks(workflow.nodes, workflow.edges),
  ];
  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function getTopologicalOrder(
  nodes: readonly NodeDefinition[],
  edges: readonly EdgeDefinition[],
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.sourceNodeId) ?? [];
    neighbors.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, neighbors);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }
  return order;
}
