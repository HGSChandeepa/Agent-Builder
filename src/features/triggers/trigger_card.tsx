"use client";

import { CalendarClock, CheckCircle2, PauseCircle, Trash2, XCircle } from "lucide-react";
import { describeSchedule, formatRelativeTime } from "@/src/core/triggers/schedule";
import type { AgentTriggerDefinition } from "@/src/features/triggers/triggers_api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface TriggerCardProps {
  readonly trigger: AgentTriggerDefinition;
  readonly isUpdating: boolean;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onDelete: () => void;
}

function getLastRunBadge(status: string | null): { label: string; tone: "success" | "failed" | "none" } {
  if (!status) {
    return { label: "No runs yet", tone: "none" };
  }
  if (status === "completed") {
    return { label: "Last run succeeded", tone: "success" };
  }
  return { label: "Last run failed", tone: "failed" };
}

function LastRunStatus({ status }: { status: string | null }) {
  const badge = getLastRunBadge(status);
  const Icon =
    badge.tone === "success" ? CheckCircle2 : badge.tone === "failed" ? XCircle : PauseCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        badge.tone === "success" && "border-emerald-200/80 bg-emerald-50 text-emerald-700",
        badge.tone === "failed" && "border-destructive/25 bg-destructive/5 text-destructive",
        badge.tone === "none" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="size-2.5 shrink-0" />
      {badge.label}
    </span>
  );
}

export function TriggerCard({ trigger, isUpdating, onToggleEnabled, onDelete }: TriggerCardProps) {
  const scheduleLabel = describeSchedule(trigger.scheduleType, trigger.scheduleConfig, trigger.timezone);
  const successRate =
    trigger.totalRuns > 0 ? Math.round((trigger.successfulRuns / trigger.totalRuns) * 100) : null;
  return (
    <Card size="sm" className="transition-all hover:ring-foreground/15">
      <CardHeader className="gap-1.5 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{trigger.name}</CardTitle>
            <p className="truncate text-[11px] text-muted-foreground">{trigger.agentName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <LastRunStatus status={trigger.lastRunStatus} />
            <Badge variant={trigger.enabled ? "default" : "secondary"} className="text-[10px]">
              {trigger.enabled ? "Active" : "Paused"}
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <CalendarClock className="size-3 shrink-0" />
          {scheduleLabel}
        </CardDescription>
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Next run</span>
            <span className="text-foreground">
              {trigger.enabled ? formatRelativeTime(trigger.nextRunAt) : "Paused"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Last run</span>
            <span className="text-foreground">{formatRelativeTime(trigger.lastRunAt)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Total runs</span>
            <span className="text-foreground">{trigger.totalRuns}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wide">Success rate</span>
            <span className="text-foreground">{successRate !== null ? `${successRate}%` : "—"}</span>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={trigger.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={isUpdating}
            aria-label={`Toggle ${trigger.name}`}
          />
          <span className="text-xs text-muted-foreground">{trigger.enabled ? "On" : "Off"}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isUpdating}
          className="h-7 text-xs"
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
