"use client";

import type { ActivityDashboardData } from "@/src/features/integrations/integrations_api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityDashboardProps {
  readonly data: ActivityDashboardData | null;
  readonly isLoading: boolean;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "default" | "danger" }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "success") {
    return "default";
  }
  if (status === "failure") {
    return "destructive";
  }
  return "secondary";
}

export function ActivityDashboard({ data, isLoading }: ActivityDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!data) {
    return null;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Emails processed" value={data.stats.emailsProcessed} />
        <StatCard label="Triggers executed" value={data.stats.triggersExecuted} />
        <StatCard label="Emails sent" value={data.stats.emailsSent} />
        <StatCard label="Failed actions" value={data.stats.failedActions} tone="danger" />
        <StatCard label="Auth issues" value={data.stats.authIssues} tone="danger" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity log</CardTitle>
          <CardDescription>Recent integration events with timestamps</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {data.logs.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No activity yet. Connect Gmail and run an agent to see logs here.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.logs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {log.provider}
                        </Badge>
                        <Badge variant={getStatusVariant(log.status)} className="text-[10px] capitalize">
                          {log.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{log.action.replace("_", " ")}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{log.message}</p>
                    </div>
                    <time className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
