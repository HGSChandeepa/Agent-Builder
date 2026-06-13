"use client";

import { useCallback, useEffect, useMemo, type DragEvent, type MouseEvent } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  applyEdgeChanges,
  MarkerType,
  BackgroundVariant,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import { WorkflowNode } from "@/src/features/workflow-builder/workflow_node";
import { useBuilderStore } from "@/src/features/workflow-builder/builder_store";
import type { EdgeDefinition, WorkflowDefinition } from "@/src/core/workflow/types";
import type { NodePluginSummary } from "@/src/features/workflow-builder/builder_store";

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

const defaultEdgeOptions = {
  style: { stroke: "var(--builder-edge)", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--builder-edge)", width: 16, height: 16 },
  selectable: true,
  interactionWidth: 24,
};
function createFlowEdge(edge: EdgeDefinition): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    ...defaultEdgeOptions,
  };
}

function toFlowEdges(edges: readonly EdgeDefinition[]): Edge[] {
  return edges.map((edge) => createFlowEdge(edge));
}

function buildFlowNodes(
  workflow: WorkflowDefinition,
  plugins: readonly NodePluginSummary[],
  selectedNodeId: string | null,
): Node[] {
  return workflow.nodes.map((node) => {
    const plugin = plugins.find((p) => p.type === node.type);
    return {
      id: node.id,
      type: "workflowNode",
      position: node.position,
      data: {
        label: node.label,
        nodeType: node.type,
        color: plugin?.color ?? "#64748b",
        category: plugin?.category ?? "unknown",
        isMutating: plugin?.isMutating ?? false,
      },
      selected: node.id === selectedNodeId,
    };
  });
}

function getNodeSyncKey(workflow: WorkflowDefinition | null): string {
  if (!workflow) {
    return "";
  }
  return workflow.nodes
    .map((node) => `${node.id}:${node.type}:${node.label}:${node.position.x},${node.position.y}`)
    .join("|");
}

function getEdgeSyncKey(workflow: WorkflowDefinition | null): string {
  if (!workflow) {
    return "";
  }
  return workflow.edges
    .map(
      (edge) =>
        `${edge.id}:${edge.sourceNodeId}:${edge.sourcePortId}:${edge.targetNodeId}:${edge.targetPortId}`,
    )
    .join("|");
}

function areFlowNodesEqual(firstNodes: readonly Node[], secondNodes: readonly Node[]): boolean {
  if (firstNodes.length !== secondNodes.length) {
    return false;
  }
  return firstNodes.every((firstNode, index) => {
    const secondNode = secondNodes[index];
    return (
      secondNode !== undefined &&
      firstNode.id === secondNode.id &&
      firstNode.type === secondNode.type &&
      firstNode.position.x === secondNode.position.x &&
      firstNode.position.y === secondNode.position.y &&
      firstNode.selected === secondNode.selected &&
      firstNode.data.label === secondNode.data.label &&
      firstNode.data.nodeType === secondNode.data.nodeType &&
      firstNode.data.color === secondNode.data.color &&
      firstNode.data.category === secondNode.data.category &&
      firstNode.data.isMutating === secondNode.data.isMutating
    );
  });
}

function areFlowEdgesEqual(firstEdges: readonly Edge[], secondEdges: readonly Edge[]): boolean {
  if (firstEdges.length !== secondEdges.length) {
    return false;
  }
  return firstEdges.every((firstEdge, index) => {
    const secondEdge = secondEdges[index];
    return (
      secondEdge !== undefined &&
      firstEdge.id === secondEdge.id &&
      firstEdge.source === secondEdge.source &&
      firstEdge.target === secondEdge.target &&
      firstEdge.sourceHandle === secondEdge.sourceHandle &&
      firstEdge.targetHandle === secondEdge.targetHandle &&
      firstEdge.selected === secondEdge.selected
    );
  });
}

export function WorkflowCanvas() {
  const workflow = useBuilderStore((state) => state.workflow);
  const plugins = useBuilderStore((state) => state.plugins);
  const selectedNodeId = useBuilderStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useBuilderStore((state) => state.setSelectedNodeId);
  const updateNodes = useBuilderStore((state) => state.updateNodes);
  const updateEdges = useBuilderStore((state) => state.updateEdges);
  const addNode = useBuilderStore((state) => state.addNode);
  const nodeSyncKey = useMemo(() => getNodeSyncKey(workflow), [workflow]);
  const edgeSyncKey = useMemo(() => getEdgeSyncKey(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  useEffect(() => {
    if (!workflow) {
      return;
    }
    const currentSelectedId = useBuilderStore.getState().selectedNodeId;
    const nextNodes = buildFlowNodes(workflow, plugins, currentSelectedId);
    setNodes((currentNodes) => (areFlowNodesEqual(currentNodes, nextNodes) ? currentNodes : nextNodes));
  }, [nodeSyncKey, plugins, setNodes]);
  useEffect(() => {
    if (!workflow) {
      return;
    }
    const nextEdges = toFlowEdges(workflow.edges);
    setEdges((currentEdges) => (areFlowEdgesEqual(currentEdges, nextEdges) ? currentEdges : nextEdges));
  }, [edgeSyncKey, workflow, setEdges]);
  useEffect(() => {
    setNodes((currentNodes) => {
      const nextNodes = currentNodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      }));
      return areFlowNodesEqual(currentNodes, nextNodes) ? currentNodes : nextNodes;
    });
  }, [selectedNodeId, setNodes]);
  const onInit = useCallback((instance: ReactFlowInstance) => {
    void instance.fitView({ padding: 0.2 });
  }, []);
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      if (connection.source === connection.target) {
        return;
      }
      const currentWorkflow = useBuilderStore.getState().workflow;
      if (!currentWorkflow) {
        return;
      }
      const sourcePortId = connection.sourceHandle ?? "output";
      const targetPortId = connection.targetHandle ?? "input";
      const isDuplicateConnection = currentWorkflow.edges.some(
        (edge) =>
          edge.sourceNodeId === connection.source &&
          edge.targetNodeId === connection.target &&
          edge.sourcePortId === sourcePortId &&
          edge.targetPortId === targetPortId,
      );
      if (isDuplicateConnection) {
        return;
      }
      const newEdge: EdgeDefinition = {
        id: uuidv4(),
        sourceNodeId: connection.source,
        sourcePortId,
        targetNodeId: connection.target,
        targetPortId,
      };
      setEdges((currentEdges) => addEdge(createFlowEdge(newEdge), currentEdges));
      updateEdges([...currentWorkflow.edges, newEdge]);
    },
    [setEdges, updateEdges],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
      const removedChanges = changes.filter((change) => change.type === "remove");
      if (removedChanges.length === 0) {
        return;
      }
      const currentWorkflow = useBuilderStore.getState().workflow;
      if (!currentWorkflow) {
        return;
      }
      const removedIds = new Set(
        removedChanges.map((change) => (change.type === "remove" ? change.id : "")),
      );
      updateEdges(currentWorkflow.edges.filter((edge) => !removedIds.has(edge.id)));
    },
    [setEdges, updateEdges],
  );
  const onEdgeClick = useCallback(
    (_event: MouseEvent, _edge: Edge) => {
      setSelectedNodeId(null);
    },
    [setSelectedNodeId],
  );
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      const currentWorkflow = useBuilderStore.getState().workflow;
      if (!currentWorkflow) {
        return;
      }
      const updatedNodes = currentWorkflow.nodes.map((n) =>
        n.id === node.id ? { ...n, position: node.position } : n,
      );
      updateNodes(updatedNodes);
    },
    [updateNodes],
  );
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const nextSelectedNodeId = selectedNodes[0]?.id ?? null;
      if (useBuilderStore.getState().selectedNodeId === nextSelectedNodeId) {
        return;
      }
      setSelectedNodeId(nextSelectedNodeId);
    },
    [setSelectedNodeId],
  );
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) {
        return;
      }
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      addNode(type, {
        x: event.clientX - bounds.left - 84,
        y: event.clientY - bounds.top - 24,
      });
    },
    [addNode],
  );
  if (!workflow) {
    return (
      <div className="builder-canvas flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading workflow...</p>
      </div>
    );
  }
  return (
    <div className="builder-canvas h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        colorMode="light"
        connectOnClick
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: "var(--builder-edge)", strokeWidth: 2 }}
        connectionRadius={28}
        defaultEdgeOptions={defaultEdgeOptions}
        elementsSelectable
        edgesFocusable
        elevateEdgesOnSelect
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1.25} variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} position="bottom-left" className="bottom-16!" />
      </ReactFlow>
    </div>
  );
}
