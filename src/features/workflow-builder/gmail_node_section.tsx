"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Braces } from "lucide-react";
import { fetchIntegrationConnections } from "@/src/features/integrations/integrations_api";
import type { IntegrationConnectionSummary } from "@/src/integrations/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const GMAIL_NODE_TYPE = "Gmail";

export interface OutputPathOption {
  readonly value: string;
  readonly label: string;
}

interface GmailNodeSectionProps {
  readonly config: Record<string, unknown>;
  readonly outputPathOptions: readonly OutputPathOption[];
  readonly onConfigChange: (key: string, value: unknown) => void;
}

export function isGmailNodeType(nodeType: string): boolean {
  return nodeType === GMAIL_NODE_TYPE;
}

function getStringValue(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return value === undefined || value === null ? "" : String(value);
}

function InsertReferenceMenu({
  options,
  onInsert,
}: {
  readonly options: readonly OutputPathOption[];
  readonly onInsert: (token: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" title="Insert value from a previous step">
            <Braces />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onInsert(`{{${option.value}}}`)}>
            <span className="font-mono text-[11px]">{option.value}</span>
            <span className="ml-2 truncate text-[10px] text-muted-foreground">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FieldWithReference({
  id,
  label,
  value,
  placeholder,
  multiline,
  options,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly options: readonly OutputPathOption[];
  readonly onChange: (value: string) => void;
}) {
  function handleInsert(token: string): void {
    onChange(value ? `${value}${value.endsWith(" ") ? "" : " "}${token}` : token);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <InsertReferenceMenu options={options} onInsert={handleInsert} />
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          placeholder={placeholder}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function SendFields({
  config,
  outputPathOptions,
  onConfigChange,
}: GmailNodeSectionProps) {
  const useAiBody = Boolean(config.useAiBody ?? false);
  return (
    <>
      <FieldWithReference
        id="gmail-to"
        label="To"
        value={getStringValue(config, "to")}
        placeholder="user@example.com, {{email.from}}"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("to", value)}
      />
      <FieldWithReference
        id="gmail-cc"
        label="CC"
        value={getStringValue(config, "cc")}
        placeholder="Optional"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("cc", value)}
      />
      <FieldWithReference
        id="gmail-bcc"
        label="BCC"
        value={getStringValue(config, "bcc")}
        placeholder="Optional"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("bcc", value)}
      />
      <FieldWithReference
        id="gmail-subject"
        label="Subject"
        value={getStringValue(config, "subject")}
        placeholder="Re: {{email.subject}}"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("subject", value)}
      />
      <div className="space-y-2">
        <Label htmlFor="gmail-body-format">Body format</Label>
        <Select
          value={getStringValue(config, "bodyFormat") || "plain"}
          onValueChange={(value) => value && onConfigChange("bodyFormat", value)}
        >
          <SelectTrigger id="gmail-body-format" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Plain Text</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="gmail-use-ai-body"
          checked={useAiBody}
          onCheckedChange={(checked) => onConfigChange("useAiBody", checked)}
        />
        <Label htmlFor="gmail-use-ai-body" className="font-normal text-muted-foreground">
          Use AI-generated body from input (response)
        </Label>
      </div>
      {!useAiBody && (
        <FieldWithReference
          id="gmail-body"
          label="Body"
          value={getStringValue(config, "body")}
          placeholder="Hi {{email.from}}, thanks for reaching out. {{response}}"
          multiline
          options={outputPathOptions}
          onChange={(value) => onConfigChange("body", value)}
        />
      )}
      <FieldWithReference
        id="gmail-attachments"
        label="Attachments (path to array from a previous step)"
        value={getStringValue(config, "attachmentsPath")}
        placeholder="files"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("attachmentsPath", value)}
      />
      <p className="text-[11px] text-muted-foreground">
        Attachments expect an array of objects with filename, mimeType, and contentBase64.
      </p>
      <div className="flex items-center gap-2">
        <Switch
          id="gmail-preview"
          checked={Boolean(config.previewOnly)}
          onCheckedChange={(checked) => onConfigChange("previewOnly", checked)}
        />
        <Label htmlFor="gmail-preview" className="font-normal text-muted-foreground">
          Preview only (do not actually send)
        </Label>
      </div>
    </>
  );
}

function ReadFields({ config, outputPathOptions, onConfigChange }: GmailNodeSectionProps) {
  return (
    <>
      <FieldWithReference
        id="gmail-message-id"
        label="Message ID"
        value={getStringValue(config, "messageId")}
        placeholder="{{email.id}}"
        options={outputPathOptions}
        onChange={(value) => onConfigChange("messageId", value)}
      />
      <div className="flex items-center gap-2">
        <Switch
          id="gmail-include-body"
          checked={Boolean(config.includeBody ?? true)}
          onCheckedChange={(checked) => onConfigChange("includeBody", checked)}
        />
        <Label htmlFor="gmail-include-body" className="font-normal text-muted-foreground">
          Include email body content
        </Label>
      </div>
    </>
  );
}

function MonitorFields({ config, onConfigChange }: GmailNodeSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="gmail-sender">Sender filter</Label>
        <Input
          id="gmail-sender"
          value={getStringValue(config, "senderFilter")}
          onChange={(event) => onConfigChange("senderFilter", event.target.value)}
          placeholder="support@company.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gmail-subject-keywords">Subject keywords</Label>
        <Input
          id="gmail-subject-keywords"
          value={getStringValue(config, "subjectKeywords")}
          onChange={(event) => onConfigChange("subjectKeywords", event.target.value)}
          placeholder="invoice OR receipt"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gmail-labels">Labels</Label>
        <Input
          id="gmail-labels"
          value={getStringValue(config, "labels") || "INBOX"}
          onChange={(event) => onConfigChange("labels", event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="gmail-date-from">Date from</Label>
          <Input
            id="gmail-date-from"
            value={getStringValue(config, "dateFrom")}
            onChange={(event) => onConfigChange("dateFrom", event.target.value)}
            placeholder="2026/01/01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gmail-date-to">Date to</Label>
          <Input
            id="gmail-date-to"
            value={getStringValue(config, "dateTo")}
            onChange={(event) => onConfigChange("dateTo", event.target.value)}
            placeholder="2026/12/31"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="gmail-poll">Poll interval (min)</Label>
          <Input
            id="gmail-poll"
            type="number"
            value={getStringValue(config, "pollIntervalMinutes") || "5"}
            onChange={(event) => onConfigChange("pollIntervalMinutes", Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gmail-max">Max emails</Label>
          <Input
            id="gmail-max"
            type="number"
            value={getStringValue(config, "maxResults") || "10"}
            onChange={(event) => onConfigChange("maxResults", Number(event.target.value))}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="gmail-unread"
          checked={Boolean(config.unreadOnly ?? true)}
          onCheckedChange={(checked) => onConfigChange("unreadOnly", checked)}
        />
        <Label htmlFor="gmail-unread" className="font-normal text-muted-foreground">
          Unread only
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="gmail-realtime"
          checked={Boolean(config.realtime)}
          onCheckedChange={(checked) => onConfigChange("realtime", checked)}
        />
        <Label htmlFor="gmail-realtime" className="font-normal text-muted-foreground">
          Real-time monitoring
        </Label>
      </div>
    </>
  );
}

export function GmailNodeSection({ config, outputPathOptions, onConfigChange }: GmailNodeSectionProps) {
  const [connections, setConnections] = useState<readonly IntegrationConnectionSummary[]>([]);
  const action = getStringValue(config, "action") || "send";
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
      } catch {
        /* connections optional */
      }
    }
    loadConnections();
    return () => {
      isActive = false;
    };
  }, []);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gmail-action">Action</Label>
        <Select value={action} onValueChange={(value) => value && onConfigChange("action", value)}>
          <SelectTrigger id="gmail-action" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send">Send email</SelectItem>
            <SelectItem value="read">Read email</SelectItem>
            <SelectItem value="monitor">Monitor inbox</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gmail-connection">Gmail account</Label>
        {gmailConnections.length > 0 ? (
          <Select
            value={getStringValue(config, "connectionId")}
            onValueChange={(value) => value && onConfigChange("connectionId", value)}
          >
            <SelectTrigger id="gmail-connection" className="w-full">
              <SelectValue placeholder="Select connected account" />
            </SelectTrigger>
            <SelectContent>
              {gmailConnections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.accountEmail ?? connection.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">No Gmail account connected.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              nativeButton={false}
              render={<Link href="/integrations" />}
            >
              Connect Gmail
            </Button>
          </div>
        )}
      </div>
      {action === "send" && (
        <SendFields config={config} outputPathOptions={outputPathOptions} onConfigChange={onConfigChange} />
      )}
      {action === "read" && (
        <ReadFields config={config} outputPathOptions={outputPathOptions} onConfigChange={onConfigChange} />
      )}
      {action === "monitor" && (
        <MonitorFields config={config} outputPathOptions={outputPathOptions} onConfigChange={onConfigChange} />
      )}
      {outputPathOptions.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Connect this node after others to reference their outputs with {"{{path}}"}.
        </p>
      )}
    </div>
  );
}
