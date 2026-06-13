"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AgentIntegrationsConfig, GmailAgentIntegrationConfig } from "@/src/core/workflow/types";
import { DEFAULT_GMAIL_MONITORING_RULES } from "@/src/integrations/types";
import { fetchIntegrationConnections } from "@/src/features/integrations/integrations_api";
import type { IntegrationConnectionSummary } from "@/src/integrations/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface AgentIntegrationsPanelProps {
  readonly integrations: AgentIntegrationsConfig;
  readonly onChange: (integrations: AgentIntegrationsConfig) => void;
}

function buildDefaultGmailConfig(connectionId: string): GmailAgentIntegrationConfig {
  return {
    provider: "gmail",
    connectionId,
    monitoringRules: { ...DEFAULT_GMAIL_MONITORING_RULES },
    autoReplyEnabled: false,
    replyTemplate: "Thank you for your email. We will get back to you shortly.",
    outgoingTemplate: "Hello,\n\n{{response}}\n\nBest regards",
  };
}

export function AgentIntegrationsPanel({ integrations, onChange }: AgentIntegrationsPanelProps) {
  const [connections, setConnections] = useState<readonly IntegrationConnectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const gmailConfig = integrations.gmail;
  const gmailConnections = connections.filter(
    (connection) => connection.provider === "gmail" && connection.status === "connected",
  );
  useEffect(() => {
    let isActive = true;
    async function loadConnections(): Promise<void> {
      try {
        const data = await fetchIntegrationConnections();
        if (isActive) {
          setConnections(data);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    loadConnections();
    return () => {
      isActive = false;
    };
  }, []);
  function updateGmailConfig(partial: Partial<GmailAgentIntegrationConfig>): void {
    const base = gmailConfig ?? buildDefaultGmailConfig(gmailConnections[0]?.id ?? "");
    onChange({ ...integrations, gmail: { ...base, ...partial } });
  }
  function updateMonitoringRules(key: keyof GmailAgentIntegrationConfig["monitoringRules"], value: string | boolean | number): void {
    const base = gmailConfig ?? buildDefaultGmailConfig(gmailConnections[0]?.id ?? "");
    onChange({
      ...integrations,
      gmail: {
        ...base,
        monitoringRules: { ...base.monitoringRules, [key]: value },
      },
    });
  }
  function handleEnableGmail(enabled: boolean): void {
    if (!enabled) {
      const next = { ...integrations };
      delete next.gmail;
      onChange(next);
      return;
    }
    const connectionId = gmailConnections[0]?.id ?? "";
    onChange({ ...integrations, gmail: buildDefaultGmailConfig(connectionId) });
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Agent integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect this agent to third-party services. Configure monitoring rules, triggers, and email templates.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Gmail</h3>
            <p className="text-xs text-muted-foreground">Monitor inbox, trigger workflows, and send emails</p>
          </div>
          <Switch checked={Boolean(gmailConfig)} onCheckedChange={handleEnableGmail} />
        </div>
        {gmailConfig && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading connections…</p>
            ) : gmailConnections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">No Gmail account connected.</p>
                <Button variant="outline" size="sm" className="mt-3" nativeButton={false} render={<Link href="/integrations" />}>
                  Connect Gmail
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Gmail account</Label>
                  <Select
                    value={gmailConfig.connectionId}
                    onValueChange={(value) => value && updateGmailConfig({ connectionId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {gmailConnections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          {connection.accountEmail ?? connection.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sender filter</Label>
                    <Input
                      value={gmailConfig.monitoringRules.senderFilter}
                      onChange={(event) => updateMonitoringRules("senderFilter", event.target.value)}
                      placeholder="support@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject keywords</Label>
                    <Input
                      value={gmailConfig.monitoringRules.subjectKeywords}
                      onChange={(event) => updateMonitoringRules("subjectKeywords", event.target.value)}
                      placeholder="invoice OR receipt"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Labels</Label>
                    <Input
                      value={gmailConfig.monitoringRules.labels}
                      onChange={(event) => updateMonitoringRules("labels", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Poll interval (minutes)</Label>
                    <Input
                      type="number"
                      value={gmailConfig.monitoringRules.pollIntervalMinutes}
                      onChange={(event) =>
                        updateMonitoringRules("pollIntervalMinutes", Number(event.target.value))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={gmailConfig.monitoringRules.unreadOnly}
                      onCheckedChange={(checked) => updateMonitoringRules("unreadOnly", checked)}
                    />
                    <Label className="font-normal">Unread only</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={gmailConfig.monitoringRules.realtime}
                      onCheckedChange={(checked) => updateMonitoringRules("realtime", checked)}
                    />
                    <Label className="font-normal">Real-time monitoring</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={gmailConfig.autoReplyEnabled}
                      onCheckedChange={(checked) => updateGmailConfig({ autoReplyEnabled: checked })}
                    />
                    <Label className="font-normal">Automatic replies</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reply template</Label>
                  <Textarea
                    value={gmailConfig.replyTemplate}
                    onChange={(event) => updateGmailConfig({ replyTemplate: event.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outgoing email template</Label>
                  <Textarea
                    value={gmailConfig.outgoingTemplate}
                    onChange={(event) => updateGmailConfig({ outgoingTemplate: event.target.value })}
                    rows={3}
                    placeholder="Use {{response}} for AI-generated content"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
