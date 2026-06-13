"use client";

import { useEffect, useState } from "react";
import type { WorkflowDefinition } from "@/src/core/workflow/types";
import {
  createTrigger,
  fetchAgents,
  type CreateTriggerInput,
  type TriggerScheduleType,
} from "@/src/features/triggers/triggers_api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateTriggerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: () => Promise<void>;
}

const INTERVAL_PRESETS = [
  { label: "Every 5 minutes", minutes: 5 },
  { label: "Every 15 minutes", minutes: 15 },
  { label: "Every 30 minutes", minutes: 30 },
  { label: "Every hour", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Every day", minutes: 1440 },
] as const;

const WEEKDAY_OPTIONS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
] as const;

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function CreateTriggerDialog({ open, onOpenChange, onCreated }: CreateTriggerDialogProps) {
  const [agents, setAgents] = useState<readonly WorkflowDefinition[]>([]);
  const [name, setName] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<TriggerScheduleType>("interval");
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [dailyHour, setDailyHour] = useState<number>(9);
  const [dailyMinute, setDailyMinute] = useState<number>(0);
  const [weeklyDay, setWeeklyDay] = useState<number>(1);
  const [weeklyHour, setWeeklyHour] = useState<number>(9);
  const [weeklyMinute, setWeeklyMinute] = useState<number>(0);
  const [cronExpression, setCronExpression] = useState<string>("0 9 * * *");
  const [timezone, setTimezone] = useState<string>(getBrowserTimezone());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const agentSelectValue = agents.some((agent) => agent.id === agentId) ? agentId : null;
  useEffect(() => {
    if (!open) {
      return;
    }
    let isActive = true;
    async function loadAgents(): Promise<void> {
      try {
        const data = await fetchAgents();
        if (isActive) {
          setAgents(data);
          if (data.length > 0) {
            setAgentId(data[0].id);
          }
        }
      } catch {
        /* optional */
      }
    }
    loadAgents();
    return () => {
      isActive = false;
    };
  }, [open]);
  function buildScheduleInput(): CreateTriggerInput["scheduleConfig"] {
    switch (scheduleType) {
      case "interval":
        return { minutes: intervalMinutes };
      case "daily":
        return { hour: dailyHour, minute: dailyMinute };
      case "weekly":
        return { dayOfWeek: weeklyDay, hour: weeklyHour, minute: weeklyMinute };
      case "cron":
        return { expression: cronExpression.trim() };
      default:
        return { minutes: 60 };
    }
  }
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give your trigger a name.");
      return;
    }
    if (!agentId) {
      setError("Select an agent to run.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await createTrigger({
        agentId,
        name: trimmedName,
        scheduleType,
        scheduleConfig: buildScheduleInput(),
        timezone,
        enabled: true,
      });
      setName("");
      onOpenChange(false);
      await onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create trigger");
    } finally {
      setIsSubmitting(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule an agent</DialogTitle>
          <DialogDescription>
            Pick an agent and set when it should run automatically — like a cron job. The scheduler
            checks every minute and runs any due triggers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trigger-name">
              Trigger name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="trigger-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Daily inbox summary"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Agent to run</Label>
            <Select
              value={agentSelectValue}
              onValueChange={(value) => value && setAgentId(value)}
              disabled={isSubmitting || agents.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground">Create an agent first from the Agents page.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Schedule type</Label>
            <Select
              value={scheduleType}
              onValueChange={(value) => value && setScheduleType(value as TriggerScheduleType)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interval">Repeating interval</SelectItem>
                <SelectItem value="daily">Daily at a time</SelectItem>
                <SelectItem value="weekly">Weekly on a day</SelectItem>
                <SelectItem value="cron">Custom cron expression</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scheduleType === "interval" && (
            <div className="space-y-2">
              <Label>How often</Label>
              <Select
                value={intervalMinutes.toString()}
                onValueChange={(value) => value && setIntervalMinutes(Number.parseInt(value, 10))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_PRESETS.map((preset) => (
                    <SelectItem key={preset.minutes} value={preset.minutes.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scheduleType === "daily" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="daily-hour">Hour (0–23)</Label>
                <Input
                  id="daily-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={dailyHour}
                  onChange={(event) => setDailyHour(Number.parseInt(event.target.value, 10) || 0)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-minute">Minute (0–59)</Label>
                <Input
                  id="daily-minute"
                  type="number"
                  min={0}
                  max={59}
                  value={dailyMinute}
                  onChange={(event) => setDailyMinute(Number.parseInt(event.target.value, 10) || 0)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}
          {scheduleType === "weekly" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select
                  value={weeklyDay.toString()}
                  onValueChange={(value) => value && setWeeklyDay(Number.parseInt(value, 10))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weekly-hour">Hour (0–23)</Label>
                  <Input
                    id="weekly-hour"
                    type="number"
                    min={0}
                    max={23}
                    value={weeklyHour}
                    onChange={(event) => setWeeklyHour(Number.parseInt(event.target.value, 10) || 0)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekly-minute">Minute (0–59)</Label>
                  <Input
                    id="weekly-minute"
                    type="number"
                    min={0}
                    max={59}
                    value={weeklyMinute}
                    onChange={(event) => setWeeklyMinute(Number.parseInt(event.target.value, 10) || 0)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          )}
          {scheduleType === "cron" && (
            <div className="space-y-2">
              <Label htmlFor="cron-expression">Cron expression</Label>
              <Input
                id="cron-expression"
                value={cronExpression}
                onChange={(event) => setCronExpression(event.target.value)}
                placeholder="0 9 * * *"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Five fields: minute hour day month weekday. Example: 0 9 * * * runs daily at 9:00 AM.
              </p>
            </div>
          )}
          {scheduleType !== "interval" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-timezone">Timezone</Label>
              <Input
                id="trigger-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="UTC"
                disabled={isSubmitting}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || agents.length === 0}>
              {isSubmitting ? "Creating…" : "Create trigger"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
