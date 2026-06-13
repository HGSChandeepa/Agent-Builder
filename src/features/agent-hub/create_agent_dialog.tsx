"use client";

import { useEffect, useState } from "react";
import type { AgentIntegrationsConfig, WorkflowEnvironment } from "@/src/core/workflow/types";
import { DEFAULT_GMAIL_MONITORING_RULES } from "@/src/integrations/types";
import { fetchIntegrationConnections } from "@/src/features/integrations/integrations_api";
import type { IntegrationConnectionSummary } from "@/src/integrations/types";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface CreateAgentDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreate: (input: {
    name: string;
    description: string;
    environment: WorkflowEnvironment;
    integrations?: AgentIntegrationsConfig;
  }) => Promise<void>;
  readonly isCreating: boolean;
}

export function CreateAgentDialog({ open, onOpenChange, onCreate, isCreating }: CreateAgentDialogProps) {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [environment, setEnvironment] = useState<WorkflowEnvironment>("development");
  const [enableGmail, setEnableGmail] = useState<boolean>(false);
  const [gmailConnectionId, setGmailConnectionId] = useState<string>("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(false);
  const [connections, setConnections] = useState<readonly IntegrationConnectionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const gmailConnections = connections.filter(
    (connection) => connection.provider === "gmail" && connection.status === "connected",
  );
  useEffect(() => {
    if (!open) {
      return;
    }
    let isActive = true;
    async function loadConnections(): Promise<void> {
      try {
        const data = await fetchIntegrationConnections();
        if (isActive) {
          setConnections(data);
          const firstGmail = data.find(
            (connection) => connection.provider === "gmail" && connection.status === "connected",
          );
          if (firstGmail) {
            setGmailConnectionId(firstGmail.id);
          }
        }
      } catch {
        /* connections are optional during creation */
      }
    }
    loadConnections();
    return () => {
      isActive = false;
    };
  }, [open]);
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give your agent a name before going online.");
      return;
    }
    if (enableGmail && !gmailConnectionId) {
      setError("Select a connected Gmail account or disable Gmail integration.");
      return;
    }
    setError(null);
    const integrations: AgentIntegrationsConfig | undefined = enableGmail
      ? {
          gmail: {
            provider: "gmail",
            connectionId: gmailConnectionId,
            monitoringRules: { ...DEFAULT_GMAIL_MONITORING_RULES },
            autoReplyEnabled,
            replyTemplate: "Thank you for your email. We will get back to you shortly.",
            outgoingTemplate: "Hello,\n\n{{response}}\n\nBest regards",
          },
        }
      : undefined;
    try {
      await onCreate({ name: trimmedName, description: description.trim(), environment, integrations });
      setName("");
      setDescription("");
      setEnvironment("development");
      setEnableGmail(false);
      setAutoReplyEnabled(false);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create agent");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new agent</DialogTitle>
          <DialogDescription>
            Define the agent you want to bring online. You can connect Gmail and customize its workflow in the builder next.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              Agent name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Customer Support Agent"
              disabled={isCreating}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-environment">Environment</Label>
            <Select
              value={environment}
              onValueChange={(value) => setEnvironment(value as WorkflowEnvironment)}
              disabled={isCreating}
            >
              <SelectTrigger id="agent-environment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Gmail integration</Label>
                <p className="text-xs text-muted-foreground">Enable inbox monitoring and email actions</p>
              </div>
              <Switch checked={enableGmail} onCheckedChange={setEnableGmail} disabled={isCreating} />
            </div>
            {enableGmail && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-2">
                  <Label>Connected Gmail account</Label>
                  <Select
                    value={gmailConnectionId}
                    onValueChange={(value) => value && setGmailConnectionId(value)}
                    disabled={isCreating || gmailConnections.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Gmail account" />
                    </SelectTrigger>
                    <SelectContent>
                      {gmailConnections.map((connection) => (
                        <SelectItem key={connection.id} value={connection.id}>
                          {connection.accountEmail ?? connection.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {gmailConnections.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Connect Gmail from the Integrations page first.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={autoReplyEnabled}
                    onCheckedChange={setAutoReplyEnabled}
                    disabled={isCreating}
                  />
                  <Label className="font-normal text-muted-foreground">Enable automatic email replies</Label>
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating…" : "Create & open builder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
