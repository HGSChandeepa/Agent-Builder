"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import type { Run } from "@/src/core/execution/types";
import { WorkflowCanvas } from "@/src/features/workflow-builder/workflow_canvas";
import { RunInspector } from "@/src/features/run-inspector/run_inspector";
import { BuilderNavSidebar } from "@/src/features/workflow-builder/builder_nav_sidebar";
import { BuilderRightPanel } from "@/src/features/workflow-builder/builder_right_panel";
import { WorkflowTopBar, type BuilderViewTab } from "@/src/features/workflow-builder/workflow_top_bar";
import { WorkflowExecuteBar } from "@/src/features/workflow-builder/workflow_execute_bar";
import {
  useBuilderStore,
  fetchPlugins,
  fetchWorkflow,
  saveWorkflow,
  executeWorkflow,
  fetchRuns,
} from "@/src/features/workflow-builder/builder_store";
import { AgentIntegrationsPanel } from "@/src/features/workflow-builder/agent_integrations_panel";
import { SlateToast } from "@/src/features/shared/slate_toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentBuilderAppProps {
  readonly workflowId: string;
}

export function AgentBuilderApp({ workflowId }: AgentBuilderAppProps) {
  const workflow = useBuilderStore((state) => state.workflow);
  const activeRun = useBuilderStore((state) => state.activeRun);
  const runs = useBuilderStore((state) => state.runs);
  const isSimulation = useBuilderStore((state) => state.isSimulation);
  const validationIssues = useBuilderStore((state) => state.validationIssues);
  const setWorkflow = useBuilderStore((state) => state.setWorkflow);
  const setPlugins = useBuilderStore((state) => state.setPlugins);
  const setActiveRun = useBuilderStore((state) => state.setActiveRun);
  const setRuns = useBuilderStore((state) => state.setRuns);
  const setIsSimulation = useBuilderStore((state) => state.setIsSimulation);
  const setValidationIssues = useBuilderStore((state) => state.setValidationIssues);
  const setSelectedNodeId = useBuilderStore((state) => state.setSelectedNodeId);
  const updateIntegrations = useBuilderStore((state) => state.updateIntegrations);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<BuilderViewTab>("editor");
  const [runInput, setRunInput] = useState<string>('{"message": "Help me reset my password"}');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const workflowIntegrations = useMemo(
    () => workflow?.integrations ?? {},
    [workflow?.integrations],
  );
  useEffect(() => {
    async function load(): Promise<void> {
      setLoadError(null);
      setWorkflow(null);
      setSelectedNodeId(null);
      setActiveRun(null);
      setRuns([]);
      try {
        const [plugins, { workflow: wf, validation }] = await Promise.all([
          fetchPlugins(),
          fetchWorkflow(workflowId),
        ]);
        setPlugins(plugins);
        setWorkflow(wf);
        setValidationIssues(validation.issues);
        const runs = await fetchRuns(wf.id);
        setRuns(runs);
        if (runs.length > 0) {
          setActiveRun(runs[0]);
        }
      } catch {
        setLoadError("Agent not found or failed to load.");
      }
    }
    load();
  }, [workflowId, setWorkflow, setPlugins, setSelectedNodeId, setActiveRun, setRuns, setValidationIssues]);
  useEffect(() => {
    if (!saveNotice) {
      return;
    }
    const timer = window.setTimeout(() => setSaveNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);
  const handleSave = useCallback(async (): Promise<void> => {
    if (!workflow) {
      return;
    }
    setIsSaving(true);
    try {
      const { workflow: saved, validation } = await saveWorkflow(workflow);
      setWorkflow(saved);
      setValidationIssues(validation.issues);
      setSaveNotice("Changes saved");
    } finally {
      setIsSaving(false);
    }
  }, [workflow, setWorkflow, setValidationIssues]);
  const handlePublish = useCallback(async (): Promise<void> => {
    if (!workflow) {
      return;
    }
    setIsSaving(true);
    try {
      const { workflow: saved, validation } = await saveWorkflow({
        ...workflow,
        status: "published",
      });
      setWorkflow(saved);
      setValidationIssues(validation.issues);
      setSaveNotice("Agent published");
    } finally {
      setIsSaving(false);
    }
  }, [workflow, setWorkflow, setValidationIssues]);
  const handleRun = useCallback(async (): Promise<void> => {
    if (!workflow) {
      return;
    }
    setIsRunning(true);
    try {
      await handleSave();
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(runInput);
      } catch {
        input = { message: runInput };
      }
      const run = await executeWorkflow(workflow.id, input, isSimulation);
      setActiveRun(run);
      const runs = await fetchRuns(workflow.id);
      setRuns(runs);
      setActiveTab("executions");
    } finally {
      setIsRunning(false);
    }
  }, [workflow, runInput, isSimulation, handleSave, setActiveRun, setRuns]);
  const handleReplay = useCallback(async (): Promise<void> => {
    await handleRun();
  }, [handleRun]);
  const handleRunUpdated = useCallback(
    (run: Run): void => {
      setActiveRun(run);
      const hasRun = runs.some((existingRun) => existingRun.id === run.id);
      const nextRuns = hasRun
        ? runs.map((existingRun) => (existingRun.id === run.id ? run : existingRun))
        : [run, ...runs];
      setRuns(nextRuns);
    },
    [runs, setActiveRun, setRuns],
  );
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Back to all agents
        </Button>
      </div>
    );
  }
  if (!workflow) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading agent builder…</p>
      </div>
    );
  }
  return (
    <div className="builder-workspace flex h-screen flex-col bg-background">
      <WorkflowTopBar
        workflow={workflow}
        activeTab={activeTab}
        validationIssueCount={validationIssues.length}
        isSaving={isSaving}
        onTabChange={setActiveTab}
        onSave={handleSave}
        onPublish={handlePublish}
      />
      <div className="flex min-h-0 flex-1">
        <BuilderNavSidebar workflowName={workflow.name} />
        <div
          className={cn(
            "relative flex min-w-0 flex-1",
            activeTab !== "editor" && "hidden",
          )}
        >
          <main className="relative min-w-0 flex-1">
            <ReactFlowProvider>
              <WorkflowCanvas />
            </ReactFlowProvider>
            <WorkflowExecuteBar
              isRunning={isRunning}
              isSimulation={isSimulation}
              runInput={runInput}
              onRun={handleRun}
              onSimulationChange={setIsSimulation}
              onRunInputChange={setRunInput}
            />
          </main>
          <BuilderRightPanel />
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 border-l border-border bg-background",
            activeTab !== "executions" && "hidden",
          )}
        >
          <RunInspector
            run={activeRun}
            runs={runs}
            onRunUpdated={handleRunUpdated}
            onRunSelected={setActiveRun}
            onReplay={handleReplay}
          />
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 overflow-y-auto border-l border-border bg-background",
            activeTab !== "integrations" && "hidden",
          )}
        >
          <AgentIntegrationsPanel
            integrations={workflowIntegrations}
            onChange={updateIntegrations}
          />
        </div>
      </div>
      <SlateToast message={saveNotice} />
    </div>
  );
}
