"use client";

import { useState } from "react";
import type { Run, StepRun } from "@/src/core/execution/types";
import { approveRun } from "@/src/features/workflow-builder/builder_store";
import { PanelHeader } from "@/src/features/workflow-builder/panel_header";
import { StatusBadge } from "@/src/features/workflow-builder/status_badge";
import type { StatusBadgeVariant } from "@/src/features/workflow-builder/status_badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  pending: "default",
  running: "info",
  completed: "success",
  failed: "danger",
  waiting_approval: "warning",
  paused: "info",
  cancelled: "default",
  skipped: "default",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Done",
  failed: "Failed",
  waiting_approval: "Awaiting approval",
  paused: "Paused",
  cancelled: "Cancelled",
  skipped: "Skipped",
};

interface RunInspectorProps {
  readonly run: Run | null;
  readonly onRunUpdated: (run: Run) => void;
  readonly onReplay: () => void;
}

function StepTimeline({ steps }: { readonly steps: readonly StepRun[] }) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div key={step.id} className="overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-muted/50"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">{step.nodeType}</div>
              <div className="text-[10px] text-muted-foreground">
                {step.durationMs !== undefined ? `${step.durationMs}ms` : "—"}
              </div>
            </div>
            <StatusBadge variant={STATUS_VARIANT[step.status] ?? "default"}>
              {STATUS_LABELS[step.status] ?? step.status}
            </StatusBadge>
          </button>
          {expandedStepId === step.id && (
            <div className="space-y-2 border-t bg-muted/30 px-2.5 py-2">
              {step.error && (
                <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{step.error}</p>
              )}
              {step.logs.length > 0 && (
                <div className="space-y-0.5">
                  {step.logs.map((log, logIndex) => (
                    <p key={logIndex} className="text-[10px] text-muted-foreground">
                      {log.message}
                    </p>
                  ))}
                </div>
              )}
              <details className="text-[10px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View data</summary>
                <pre className="mt-1 max-h-24 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-muted-foreground">
                  {JSON.stringify({ output: step.output }, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function RunInspector({ run, onRunUpdated, onReplay }: RunInspectorProps) {
  const [isApproving, setIsApproving] = useState<boolean>(false);
  async function handleApproval(approvalId: string, approved: boolean): Promise<void> {
    if (!run) {
      return;
    }
    setIsApproving(true);
    try {
      const updatedRun = await approveRun(run.id, approvalId, approved);
      onRunUpdated(updatedRun);
    } finally {
      setIsApproving(false);
    }
  }
  if (!run) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">▶</EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>Run the workflow to see step-by-step results here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const pendingApprovals = run.approvalRequests.filter((a) => a.status === "pending");
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Last run"
        subtitle={`${run.id.slice(0, 8)}…`}
        action={
          <div className="flex items-center gap-1.5">
            {run.isSimulation && <StatusBadge variant="info">Simulated</StatusBadge>}
            <StatusBadge variant={STATUS_VARIANT[run.status] ?? "default"}>
              {STATUS_LABELS[run.status] ?? run.status}
            </StatusBadge>
            <Button variant="ghost" size="sm" onClick={onReplay}>
              Replay
            </Button>
          </div>
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {pendingApprovals.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Approval required</p>
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="mt-2">
                <p className="text-xs text-muted-foreground">{approval.action}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={isApproving} onClick={() => handleApproval(approval.id, true)}>
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isApproving}
                    onClick={() => handleApproval(approval.id, false)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {run.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{run.error}</p>
        )}
        <section>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Steps</h3>
          <StepTimeline steps={run.stepRuns} />
        </section>
        {Object.keys(run.output).length > 0 && (
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Result</h3>
            <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(run.output, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
