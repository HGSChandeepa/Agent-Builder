"use client";

import { AlertCircle, CheckCircle2, Circle, Mail, Plug } from "lucide-react";
import type { IntegrationCatalogItem } from "@/src/features/integrations/integrations_api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
  readonly item: IntegrationCatalogItem;
  readonly isConnecting: boolean;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
  readonly onReconnect: () => void;
}

function getProviderIcon(providerId: string): React.ReactNode {
  if (providerId === "gmail") {
    return <Mail className="size-4" />;
  }
  return <Plug className="size-4" />;
}

function formatRelativeTimestamp(value: string | null): string {
  if (!value) {
    return "Never synced";
  }
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return "Synced just now";
  }
  if (diffMinutes < 60) {
    return `Synced ${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Synced ${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Synced ${diffDays}d ago`;
  }
  return `Synced ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function getConnectionState(connection: IntegrationCatalogItem["connection"]): {
  label: string;
  tone: "connected" | "issue" | "disconnected";
} {
  if (!connection || connection.status === "disconnected") {
    return { label: "Not connected", tone: "disconnected" };
  }
  if (connection.status === "connected") {
    return { label: "Connected", tone: "connected" };
  }
  return { label: connection.status.replace("_", " "), tone: "issue" };
}

function ConnectionStatus({ tone, label }: { tone: "connected" | "issue" | "disconnected"; label: string }) {
  const Icon = tone === "connected" ? CheckCircle2 : tone === "issue" ? AlertCircle : Circle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        tone === "connected" && "border-emerald-200/80 bg-emerald-50 text-emerald-700",
        tone === "issue" && "border-destructive/25 bg-destructive/5 text-destructive",
        tone === "disconnected" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon className="size-2.5 shrink-0" />
      {label}
    </span>
  );
}

export function IntegrationCard({
  item,
  isConnecting,
  onConnect,
  onDisconnect,
  onReconnect,
}: IntegrationCardProps) {
  const connection = item.connection;
  const connectionState = getConnectionState(connection);
  const isConnected = connection?.status === "connected";
  const hasIssue = connection?.status === "error" || connection?.status === "token_expired";
  const visiblePermissions = item.permissions.slice(0, 2);
  const hiddenPermissionCount = item.permissions.length - visiblePermissions.length;
  return (
    <Card
      size="sm"
      className={cn(
        "transition-all hover:ring-foreground/15",
        !item.isAvailable && "opacity-75",
      )}
    >
      <CardHeader className="gap-1.5 pb-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: item.logoColor }}
            >
              {getProviderIcon(item.id)}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-sm">{item.name}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{item.category}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ConnectionStatus tone={connectionState.tone} label={connectionState.label} />
            {item.comingSoon && (
              <Badge variant="secondary" className="text-[10px]">
                Soon
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="line-clamp-1 text-xs">{item.description}</CardDescription>
        {connection && connection.status !== "disconnected" && (
          <p className="truncate text-[11px] text-muted-foreground">
            {connection.accountEmail ? `${connection.accountEmail} · ` : ""}
            {formatRelativeTimestamp(connection.lastSyncAt)}
          </p>
        )}
        {connection?.lastError && (
          <p className="line-clamp-1 text-[11px] text-destructive">{connection.lastError}</p>
        )}
        {item.permissions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {visiblePermissions.map((permission) => (
              <Badge key={permission} variant="outline" className="text-[10px] font-normal">
                {permission}
              </Badge>
            ))}
            {hiddenPermissionCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-normal">
                +{hiddenPermissionCount} more
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardFooter className="gap-1.5 pt-2">
        {!item.isAvailable ? (
          <Button variant="outline" size="sm" disabled className="h-7 w-full text-xs">
            Coming soon
          </Button>
        ) : isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
              disabled={isConnecting}
              className="h-7 flex-1 text-xs"
            >
              Reconnect
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDisconnect}
              disabled={isConnecting}
              className="h-7 flex-1 text-xs"
            >
              Disconnect
            </Button>
          </>
        ) : hasIssue ? (
          <Button size="sm" onClick={onReconnect} disabled={isConnecting} className="h-7 w-full text-xs">
            {isConnecting ? "Connecting…" : "Reconnect"}
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={isConnecting} className="h-7 w-full text-xs">
            {isConnecting ? "Connecting…" : "Connect"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
