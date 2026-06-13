"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plug, RefreshCw } from "lucide-react";
import { AppNavSidebar } from "@/src/features/shared/app_nav_sidebar";
import { IntegrationCard } from "@/src/features/integrations/integration_card";
import {
  connectIntegration,
  disconnectIntegration,
  fetchIntegrationsPageData,
  reconnectIntegration,
  type IntegrationCatalogItem,
  type IntegrationsPageData,
} from "@/src/features/integrations/integrations_api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function groupCatalogByCategory(
  catalog: readonly IntegrationCatalogItem[],
): ReadonlyArray<{ category: string; items: readonly IntegrationCatalogItem[] }> {
  const groups = new Map<string, IntegrationCatalogItem[]>();
  for (const item of catalog) {
    const existing = groups.get(item.category) ?? [];
    existing.push(item);
    groups.set(item.category, existing);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

export function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [pageData, setPageData] = useState<IntegrationsPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const loadData = useCallback(async (): Promise<void> => {
    const integrations = await fetchIntegrationsPageData();
    setPageData(integrations);
  }, []);
  const groupedCatalog = useMemo(
    () => groupCatalogByCategory(pageData?.catalog ?? []),
    [pageData?.catalog],
  );
  const connectedCount = useMemo(
    () => pageData?.catalog.filter((item) => item.connection?.status === "connected").length ?? 0,
    [pageData?.catalog],
  );
  const availableCount = useMemo(
    () => pageData?.catalog.filter((item) => item.isAvailable).length ?? 0,
    [pageData?.catalog],
  );
  useEffect(() => {
    let isActive = true;
    async function load(): Promise<void> {
      try {
        await loadData();
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
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "gmail") {
      setBanner({ type: "success", message: "Gmail connected successfully." });
    } else if (error) {
      setBanner({ type: "error", message: decodeURIComponent(error) });
    }
  }, [searchParams]);
  async function handleRefresh(): Promise<void> {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  }
  async function handleConnect(provider: string): Promise<void> {
    setConnectingProvider(provider);
    setBanner(null);
    try {
      const { authUrl } = await connectIntegration(provider);
      window.location.href = authUrl;
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Connection failed",
      });
      setConnectingProvider(null);
    }
  }
  async function handleDisconnect(provider: string): Promise<void> {
    setConnectingProvider(provider);
    setBanner(null);
    try {
      await disconnectIntegration(provider);
      await loadData();
      setBanner({ type: "success", message: "Integration disconnected." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Disconnect failed",
      });
    } finally {
      setConnectingProvider(null);
    }
  }
  async function handleReconnect(provider: string): Promise<void> {
    setConnectingProvider(provider);
    setBanner(null);
    try {
      const { authUrl } = await reconnectIntegration(provider);
      window.location.href = authUrl;
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Reconnect failed",
      });
      setConnectingProvider(null);
    }
  }
  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <AppNavSidebar activeSection="integrations" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Plug className="size-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">Integrations</h1>
                <p className="text-xs text-muted-foreground">
                  Connect third-party services for your AI agents to use
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "animate-spin" : ""} data-icon="inline-start" />
              Refresh
            </Button>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 ring-1 ring-foreground/5">
                  <p className="text-xs text-muted-foreground">Connected</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{connectedCount}</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-card px-4 py-3.5 ring-1 ring-foreground/5">
                  <p className="text-xs text-muted-foreground">Available to connect</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{availableCount}</p>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="space-y-8">
                {[1, 2].map((section) => (
                  <div key={section} className="space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3].map((item) => (
                        <Skeleton key={item} className="h-36 rounded-xl" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              groupedCatalog.map((group) => (
                <section key={group.category}>
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">{group.category}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {group.items.length} integration{group.items.length !== 1 ? "s" : ""} in this category
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <IntegrationCard
                        key={item.id}
                        item={item}
                        isConnecting={connectingProvider === item.id}
                        onConnect={() => handleConnect(item.id)}
                        onDisconnect={() => handleDisconnect(item.id)}
                        onReconnect={() => handleReconnect(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
