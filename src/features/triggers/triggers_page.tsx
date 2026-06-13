"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Plus, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/src/core/triggers/schedule";
import { AppNavSidebar } from "@/src/features/shared/app_nav_sidebar";
import { CreateTriggerDialog } from "@/src/features/triggers/create_trigger_dialog";
import { TriggerCard } from "@/src/features/triggers/trigger_card";
import {
  deleteTrigger,
  fetchTriggersPageData,
  runTriggersNow,
  updateTrigger,
  type TriggersPageData,
} from "@/src/features/triggers/triggers_api";
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

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function TriggersPage() {
  const [pageData, setPageData] = useState<TriggersPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [updatingTriggerId, setUpdatingTriggerId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const loadData = useCallback(async (): Promise<void> => {
    const data = await fetchTriggersPageData();
    setPageData(data);
  }, []);
  const triggerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const trigger of pageData?.triggers ?? []) {
      map.set(trigger.id, trigger.name);
    }
    return map;
  }, [pageData?.triggers]);
  useEffect(() => {
    let isActive = true;
    async function load(): Promise<void> {
      try {
        await loadData();
      } catch (error) {
        if (isActive) {
          setBanner({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to load triggers",
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      isActive = false;
    };
  }, [loadData]);
  async function handleRefresh(): Promise<void> {
    setIsRefreshing(true);
    setBanner(null);
    try {
      await loadData();
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to refresh",
      });
    } finally {
      setIsRefreshing(false);
    }
  }
  async function handleRunScheduler(): Promise<void> {
    setIsRefreshing(true);
    setBanner(null);
    try {
      const summary = await runTriggersNow();
      await loadData();
      setBanner({
        type: "success",
        message:
          summary.processed === 0
            ? "Scheduler checked — no triggers were due."
            : `Scheduler ran ${summary.processed} trigger${summary.processed === 1 ? "" : "s"} (${summary.completed} succeeded, ${summary.failed} failed).`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Scheduler run failed",
      });
    } finally {
      setIsRefreshing(false);
    }
  }
  async function handleToggleEnabled(triggerId: string, enabled: boolean): Promise<void> {
    setUpdatingTriggerId(triggerId);
    setBanner(null);
    try {
      await updateTrigger(triggerId, { enabled });
      await loadData();
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update trigger",
      });
    } finally {
      setUpdatingTriggerId(null);
    }
  }
  async function handleDelete(triggerId: string): Promise<void> {
    setUpdatingTriggerId(triggerId);
    setBanner(null);
    try {
      await deleteTrigger(triggerId);
      await loadData();
      setBanner({ type: "success", message: "Trigger deleted." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete trigger",
      });
    } finally {
      setUpdatingTriggerId(null);
    }
  }
  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <AppNavSidebar activeSection="triggers" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Clock className="size-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">Triggers</h1>
                <p className="text-xs text-muted-foreground">
                  Schedule agents to run automatically on a recurring schedule
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRunScheduler} disabled={isRefreshing}>
                <RefreshCw className={isRefreshing ? "animate-spin" : ""} data-icon="inline-start" />
                Run scheduler
              </Button>
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus data-icon="inline-start" />
                New trigger
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {banner && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  banner.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {banner.message}
              </div>
            )}
            {!isLoading && pageData && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Active triggers" value={pageData.metrics.activeTriggers} />
                  <MetricCard label="Paused triggers" value={pageData.metrics.pausedTriggers} />
                  <MetricCard
                    label="Next scheduled run"
                    value={formatRelativeTime(pageData.metrics.nextScheduledRun)}
                    isText
                  />
                  <MetricCard
                    label="Execution success"
                    value={
                      pageData.metrics.totalExecutions > 0
                        ? `${Math.round((pageData.metrics.successfulExecutions / pageData.metrics.totalExecutions) * 100)}%`
                        : "—"
                    }
                    isText
                  />
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  The scheduler checks for due triggers every minute. Create a trigger below, pick an
                  agent, and choose how often it should run. Execution history and timing metrics are
                  stored automatically.
                </div>
              </>
            )}
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Scheduled triggers</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pageData?.triggers.length ?? 0} trigger{(pageData?.triggers.length ?? 0) !== 1 ? "s" : ""}{" "}
                  configured
                </p>
              </div>
              {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-44 rounded-xl" />
                  ))}
                </div>
              ) : pageData && pageData.triggers.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pageData.triggers.map((trigger) => (
                    <TriggerCard
                      key={trigger.id}
                      trigger={trigger}
                      isUpdating={updatingTriggerId === trigger.id}
                      onToggleEnabled={(enabled) => handleToggleEnabled(trigger.id, enabled)}
                      onDelete={() => handleDelete(trigger.id)}
                    />
                  ))}
                </div>
              ) : (
                <Empty className="border border-dashed border-border/80 bg-card/50">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Clock />
                    </EmptyMedia>
                    <EmptyTitle>No triggers yet</EmptyTitle>
                    <EmptyDescription>
                      Schedule an agent to run on a timer — every few minutes, daily, weekly, or with a
                      custom cron expression.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Create your first trigger
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
            </section>
            {!isLoading && pageData && pageData.recentExecutions.length > 0 && (
              <section>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent executions</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last {pageData.recentExecutions.length} scheduled runs with timing metrics
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/80 bg-card ring-1 ring-foreground/5">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Trigger</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Scheduled</th>
                        <th className="px-4 py-3 font-medium">Started</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.recentExecutions.map((execution) => (
                        <tr key={execution.id} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-3">
                            {triggerNameById.get(execution.triggerId) ?? execution.triggerId.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 capitalize">{execution.status}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatRelativeTime(execution.scheduledFor)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatRelativeTime(execution.startedAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDuration(execution.durationMs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
      <CreateTriggerDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleRefresh}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 ring-1 ring-foreground/5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-semibold tracking-tight text-foreground ${
          isText ? "text-base" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
