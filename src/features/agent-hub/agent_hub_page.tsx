"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AgentIntegrationsConfig, WorkflowDefinition } from "@/src/core/workflow/types";
import { createWorkflow, fetchWorkflows } from "@/src/features/workflow-builder/builder_store";
import { AgentCard } from "@/src/features/agent-hub/agent_card";
import { CreateAgentDialog } from "@/src/features/agent-hub/create_agent_dialog";
import { AppNavSidebar } from "@/src/features/shared/app_nav_sidebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentHubPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  useEffect(() => {
    let isActive = true;
    async function loadAgents(): Promise<void> {
      try {
        const workflows = await fetchWorkflows();
        if (isActive) {
          setAgents(workflows);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    loadAgents();
    return () => {
      isActive = false;
    };
  }, []);
  const handleSelectAgent = useCallback(
    (id: string): void => {
      router.push(`/builder/${id}`);
    },
    [router],
  );
  const handleCreateAgent = useCallback(
    async (input: {
      name: string;
      description: string;
      environment: WorkflowDefinition["environment"];
      integrations?: AgentIntegrationsConfig;
    }): Promise<void> => {
      setIsCreating(true);
      try {
        const workflow = await createWorkflow(input);
        router.push(`/builder/${workflow.id}`);
      } finally {
        setIsCreating(false);
      }
    },
    [router],
  );
  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <AppNavSidebar activeSection="agents" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground shadow-sm">
              AB
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Agent Builder</h1>
              <p className="text-xs text-muted-foreground">Select an agent to customize, or create one to bring online</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            Create agent
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Your agents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {agents.length === 0
                ? "No agents yet — create your first one to get started."
                : `${agents.length} agent${agents.length !== 1 ? "s" : ""} ready to customize`}
            </p>
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((skeleton) => (
                <Skeleton key={skeleton} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <Empty className="border border-dashed bg-card/60">
              <EmptyHeader>
                <EmptyMedia variant="icon">◇</EmptyMedia>
                <EmptyTitle>No agents yet</EmptyTitle>
                <EmptyDescription>
                  Create your first agent to open the visual builder and design its workflow.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Create your first agent
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onSelect={handleSelectAgent} />
              ))}
            </div>
          )}
        </div>
      </main>
      <CreateAgentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreateAgent}
        isCreating={isCreating}
      />
      </div>
    </div>
  );
}
