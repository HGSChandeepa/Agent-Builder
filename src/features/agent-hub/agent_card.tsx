"use client";

import type { WorkflowDefinition } from "@/src/core/workflow/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/src/features/workflow-builder/status_badge";
import type { StatusBadgeVariant } from "@/src/features/workflow-builder/status_badge";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  readonly agent: WorkflowDefinition;
  readonly onSelect: (id: string) => void;
}

const STATUS_VARIANT: Record<WorkflowDefinition["status"], StatusBadgeVariant> = {
  draft: "warning",
  published: "success",
  archived: "default",
};

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AgentCard({ agent, onSelect }: AgentCardProps) {
  const nodeCount = agent.nodes.length;
  const edgeCount = agent.edges.length;
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(agent.id);
        }
      }}
      className={cn(
        "cursor-pointer transition-all hover:-translate-y-0.5 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <StatusBadge variant={STATUS_VARIANT[agent.status]}>{agent.status}</StatusBadge>
            <StatusBadge variant="info">{agent.environment}</StatusBadge>
          </div>
        </div>
        <CardTitle className="group-hover:text-primary">{agent.name}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-10">
          {agent.description || "No description yet — open to customize this agent."}
        </CardDescription>
      </CardHeader>
      <CardContent className="sr-only">Open agent builder</CardContent>
      <CardFooter className="justify-between text-xs text-muted-foreground">
        <span>
          {nodeCount} block{nodeCount !== 1 ? "s" : ""} · {edgeCount} connection{edgeCount !== 1 ? "s" : ""}
        </span>
        <span>Updated {formatRelativeDate(agent.updatedAt)}</span>
      </CardFooter>
    </Card>
  );
}
