"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useBuilderStore } from "@/src/features/workflow-builder/builder_store";
import {
  BUILDER_CATEGORY_CONFIG,
  BUILDER_CATEGORY_ORDER,
} from "@/src/features/workflow-builder/builder_category_config";
import type { NodePluginSummary } from "@/src/features/workflow-builder/builder_store";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NodePalette() {
  const plugins = useBuilderStore((state) => state.plugins);
  const workflow = useBuilderStore((state) => state.workflow);
  const addNode = useBuilderStore((state) => state.addNode);
  const [search, setSearch] = useState<string>("");
  const query = search.trim().toLowerCase();
  const filteredPlugins = useMemo(() => {
    if (!query) {
      return plugins;
    }
    return plugins.filter(
      (plugin) =>
        plugin.label.toLowerCase().includes(query) ||
        plugin.type.toLowerCase().includes(query) ||
        plugin.category.toLowerCase().includes(query),
    );
  }, [plugins, query]);
  const pluginsByCategory = useMemo(() => {
    const groups = new Map<string, NodePluginSummary[]>();
    for (const plugin of filteredPlugins) {
      const list = groups.get(plugin.category) ?? [];
      list.push(plugin);
      groups.set(plugin.category, list);
    }
    return groups;
  }, [filteredPlugins]);
  function handleDragStart(event: React.DragEvent, type: string): void {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  }
  function handleAddNode(type: string): void {
    const nodeCount = workflow?.nodes.length ?? 0;
    const columnOffset = (nodeCount % 4) * 44;
    const rowOffset = Math.floor(nodeCount / 4) * 32;
    addNode(type, { x: 260 + columnOffset, y: 120 + rowOffset });
  }
  const visibleCategories = query
    ? []
    : BUILDER_CATEGORY_ORDER.filter((categoryId) => pluginsByCategory.has(categoryId));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">What happens next?</h2>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nodes..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-2.5 py-2">
          {query ? (
            filteredPlugins.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">No blocks found</p>
            ) : (
              <div className="space-y-0.5">
                {filteredPlugins.map((plugin) => (
                  <BlockRow
                    key={plugin.type}
                    plugin={plugin}
                    onAdd={() => handleAddNode(plugin.type)}
                    onDragStart={(event) => handleDragStart(event, plugin.type)}
                  />
                ))}
              </div>
            )
          ) : (
            visibleCategories.map((categoryId) => {
              const config = BUILDER_CATEGORY_CONFIG[categoryId];
              const items = pluginsByCategory.get(categoryId) ?? [];
              const Icon = config?.icon;
              return (
                <section key={categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 px-0.5 pb-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {Icon && (
                        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                      )}
                      <h3 className="truncate text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        {config?.label ?? categoryId}
                      </h3>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground/80">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((plugin) => (
                      <BlockRow
                        key={plugin.type}
                        plugin={plugin}
                        onAdd={() => handleAddNode(plugin.type)}
                        onDragStart={(event) => handleDragStart(event, plugin.type)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface BlockRowProps {
  readonly plugin: NodePluginSummary;
  readonly onAdd: () => void;
  readonly onDragStart: (event: React.DragEvent) => void;
}

function BlockRow({ plugin, onAdd, onDragStart }: BlockRowProps) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onAdd}
      title={plugin.description}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/60"
    >
      <span
        className="size-2 shrink-0 rounded-full ring-1 ring-border/80"
        style={{ backgroundColor: plugin.color }}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{plugin.label}</span>
    </button>
  );
}
