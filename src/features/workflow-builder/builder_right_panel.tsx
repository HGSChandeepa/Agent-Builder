"use client";

import { ArrowLeft } from "lucide-react";
import { NodePalette } from "@/src/features/node-palette/node_palette";
import { PropertyPanel } from "@/src/features/workflow-builder/property_panel";
import { useResizablePanel } from "@/src/features/workflow-builder/use_resizable_panel";
import { useBuilderStore } from "@/src/features/workflow-builder/builder_store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function BuilderRightPanel() {
  const { panelWidth, onResizeStart, isResizing } = useResizablePanel();
  const selectedNodeId = useBuilderStore((state) => state.selectedNodeId);
  const workflow = useBuilderStore((state) => state.workflow);
  const plugins = useBuilderStore((state) => state.plugins);
  const setSelectedNodeId = useBuilderStore((state) => state.setSelectedNodeId);
  const selectedNode = workflow?.nodes.find((node) => node.id === selectedNodeId);
  const selectedPlugin = plugins.find((plugin) => plugin.type === selectedNode?.type);
  const isConfiguring = Boolean(selectedNodeId && selectedNode && selectedPlugin);
  return (
    <div className="relative flex h-full shrink-0" style={{ width: panelWidth }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onMouseDown={onResizeStart}
        className={cn(
          "absolute top-0 left-0 z-20 flex h-full w-1.5 -translate-x-1/2 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/20",
          isResizing && "bg-primary/30",
        )}
      >
        <span className="h-10 w-0.5 rounded-full bg-border" />
      </div>
      <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-background">
        {isConfiguring && selectedNode && selectedPlugin ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-2 py-2">
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedNodeId(null)} title="Back to blocks">
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{selectedNode.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{selectedPlugin.label}</p>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <PropertyPanel />
            </ScrollArea>
          </>
        ) : (
          <NodePalette />
        )}
      </aside>
    </div>
  );
}
