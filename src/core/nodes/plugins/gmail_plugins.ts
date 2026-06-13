import type { NodePlugin } from "@/src/core/nodes/types";
import { DEFAULT_GMAIL_MONITORING_RULES } from "@/src/integrations/types";
import {
  readGmailMessage,
  sendGmailEmail,
  syncGmailInbox,
} from "@/src/integrations/providers/gmail/service";
import type { GmailAttachment } from "@/src/integrations/providers/gmail/client";
import { logActivity } from "@/src/integrations/repository";

const DEFAULT_INPUT = [{ id: "input", label: "Input", dataType: "any" as const }];
const DEFAULT_OUTPUT = [{ id: "output", label: "Output", dataType: "any" as const }];

type GmailAction = "send" | "read" | "monitor";

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getValueByPath(source: Record<string, unknown>, path: string): unknown {
  if (!path.trim()) {
    return undefined;
  }
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function resolveTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_, key: string) => {
    const normalized = key.replace(/\[(\d+)\]/g, ".$1");
    return stringifyValue(getValueByPath(variables, normalized));
  });
}

function splitRecipients(value: string): string[] {
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function normalizeAttachments(value: unknown): GmailAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = item as Record<string, unknown>;
      const filename = String(record.filename ?? record.name ?? "").trim();
      const contentBase64 = String(record.contentBase64 ?? record.content ?? "").trim();
      if (!filename || !contentBase64) {
        return null;
      }
      return {
        filename,
        mimeType: String(record.mimeType ?? record.contentType ?? "application/octet-stream"),
        contentBase64,
      };
    })
    .filter((item): item is GmailAttachment => item !== null);
}

function getAction(config: Record<string, unknown>): GmailAction {
  const action = String(config.action ?? "send");
  if (action === "read" || action === "monitor") {
    return action;
  }
  return "send";
}

function parseMonitoringRules(config: Record<string, unknown>) {
  return {
    senderFilter: String(config.senderFilter ?? DEFAULT_GMAIL_MONITORING_RULES.senderFilter),
    subjectKeywords: String(config.subjectKeywords ?? DEFAULT_GMAIL_MONITORING_RULES.subjectKeywords),
    labels: String(config.labels ?? DEFAULT_GMAIL_MONITORING_RULES.labels),
    unreadOnly: Boolean(config.unreadOnly ?? DEFAULT_GMAIL_MONITORING_RULES.unreadOnly),
    dateFrom: String(config.dateFrom ?? DEFAULT_GMAIL_MONITORING_RULES.dateFrom),
    dateTo: String(config.dateTo ?? DEFAULT_GMAIL_MONITORING_RULES.dateTo),
    pollIntervalMinutes: Number(config.pollIntervalMinutes ?? DEFAULT_GMAIL_MONITORING_RULES.pollIntervalMinutes),
    realtime: Boolean(config.realtime ?? DEFAULT_GMAIL_MONITORING_RULES.realtime),
  };
}

async function executeSend(
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
  inputs: Record<string, unknown>,
  isSimulation: boolean,
) {
  const connectionId = String(config.connectionId ?? "");
  const toTemplate = String(config.to ?? "");
  const resolvedTo = resolveTemplate(toTemplate, variables);
  const to = splitRecipients(resolvedTo);
  const cc = splitRecipients(resolveTemplate(String(config.cc ?? ""), variables));
  const bcc = splitRecipients(resolveTemplate(String(config.bcc ?? ""), variables));
  const subject = resolveTemplate(String(config.subject ?? ""), variables) || "(no subject)";
  const bodyFormat = String(config.bodyFormat ?? "plain");
  const useAiBody = Boolean(config.useAiBody ?? false);
  const aiBody = useAiBody ? stringifyValue(inputs.response ?? inputs.body) : "";
  const bodyContent = aiBody || resolveTemplate(String(config.body ?? ""), variables) || "";
  const previewOnly = Boolean(config.previewOnly);
  const attachmentsPath = String(config.attachmentsPath ?? "").trim();
  const attachments = attachmentsPath
    ? normalizeAttachments(getValueByPath(variables, attachmentsPath))
    : normalizeAttachments(inputs.attachments);
  if (isSimulation) {
    return {
      output: {
        preview: { to, cc, bcc, subject, bodyText: bodyContent, attachments: attachments.map((a) => a.filename) },
        previewOnly,
        simulated: true,
      },
      logs: [
        {
          level: "info" as const,
          message: `[Simulation] ${previewOnly ? "Preview" : "Send"} email to ${to.join(", ") || "(no recipients)"}`,
        },
      ],
    };
  }
  if (!connectionId) {
    return {
      output: { error: "Select a Gmail account in the Gmail node configuration." },
      logs: [{ level: "error" as const, message: "Gmail account not selected" }],
    };
  }
  if (to.length === 0) {
    const hint = toTemplate.includes("{{")
      ? `The "To" reference ${JSON.stringify(toTemplate)} resolved to ${JSON.stringify(resolvedTo)}. Check that the referenced field exists in an upstream node's output.`
      : 'Set a "To" recipient, or map it from a previous step (e.g. {{emails.0.from}}).';
    return {
      output: { error: `No recipients. ${hint}` },
      logs: [{ level: "error" as const, message: `Gmail send has no recipients (to=${JSON.stringify(resolvedTo)})` }],
    };
  }
  const result = await sendGmailEmail(connectionId, getOrigin(), {
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    bodyText: bodyFormat === "plain" ? bodyContent : undefined,
    bodyHtml: bodyFormat === "html" ? bodyContent : undefined,
    attachments: attachments.length ? attachments : undefined,
    previewOnly,
  });
  return {
    output: { ...result } as Record<string, unknown>,
    logs: [
      {
        level: "info" as const,
        message: previewOnly ? "Email preview generated" : `Email sent to ${to.join(", ")}`,
      },
    ],
  };
}

async function executeRead(
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
  inputs: Record<string, unknown>,
  isSimulation: boolean,
) {
  const connectionId = String(config.connectionId ?? "");
  const messageId = resolveTemplate(String(config.messageId ?? ""), variables) || String(inputs.messageId ?? "");
  const includeBody = Boolean(config.includeBody ?? true);
  if (isSimulation) {
    return {
      output: {
        id: messageId || "sim-msg-001",
        from: "sender@example.com",
        subject: "Simulated email subject",
        bodyText: "Simulated email body content",
        date: new Date().toISOString(),
        simulated: true,
      },
      logs: [{ level: "info" as const, message: "[Simulation] Read Gmail message" }],
    };
  }
  if (!connectionId || !messageId) {
    return {
      output: { error: "A Gmail account and message ID are required" },
      logs: [{ level: "error" as const, message: "Missing Gmail connection or message ID" }],
    };
  }
  const message = await readGmailMessage(connectionId, getOrigin(), messageId, includeBody);
  return {
    output: { ...message } as Record<string, unknown>,
    logs: [{ level: "info" as const, message: `Read email: ${message.subject}` }],
  };
}

async function executeMonitor(config: Record<string, unknown>, isSimulation: boolean) {
  const connectionId = String(config.connectionId ?? "");
  const rules = parseMonitoringRules(config);
  const maxResults = Number(config.maxResults ?? 10);
  if (isSimulation) {
    return {
      output: {
        emails: [
          {
            id: "sim-msg-001",
            from: "customer@example.com",
            subject: "Help with my order",
            date: new Date().toISOString(),
            isUnread: true,
            snippet: "Simulated matching email",
          },
        ],
        count: 1,
        query: "simulated",
        monitoringMode: rules.realtime ? "realtime" : "polling",
        pollIntervalMinutes: rules.pollIntervalMinutes,
      },
      logs: [{ level: "info" as const, message: "[Simulation] Gmail monitor found 1 matching email" }],
    };
  }
  if (!connectionId) {
    return {
      output: { emails: [], count: 0, error: "No Gmail account selected" },
      logs: [{ level: "error" as const, message: "Gmail connection is required" }],
    };
  }
  const { messages, query } = await syncGmailInbox(connectionId, getOrigin(), rules, maxResults);
  if (messages.length > 0) {
    await logActivity({
      connectionId,
      action: "trigger_executed",
      status: "success",
      message: `Gmail trigger matched ${messages.length} email(s)`,
      details: { query, count: messages.length },
    });
  }
  return {
    output: {
      emails: messages,
      count: messages.length,
      query,
      monitoringMode: rules.realtime ? "realtime" : "polling",
      pollIntervalMinutes: rules.pollIntervalMinutes,
    },
    logs: [{ level: "info" as const, message: `Gmail monitor found ${messages.length} matching email(s)` }],
  };
}

export const gmailPlugin: NodePlugin = {
  type: "Gmail",
  label: "Gmail",
  description: "Send, read, or monitor Gmail. Reference upstream outputs with {{path}}.",
  category: "action",
  icon: "mail",
  color: "#EA4335",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "action", label: "Action", type: "select", required: true, defaultValue: "send", options: [
      { label: "Send email", value: "send" },
      { label: "Read email", value: "read" },
      { label: "Monitor inbox", value: "monitor" },
    ]},
    { key: "connectionId", label: "Gmail Account", type: "text", required: true },
    { key: "to", label: "To", type: "text", placeholder: "user@example.com, {{email.from}}" },
    { key: "cc", label: "CC", type: "text" },
    { key: "bcc", label: "BCC", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "bodyFormat", label: "Body Format", type: "select", defaultValue: "plain", options: [
      { label: "Plain Text", value: "plain" },
      { label: "HTML", value: "html" },
    ]},
    { key: "body", label: "Body", type: "textarea", placeholder: "Hi {{email.from}}, {{response}}" },
    { key: "useAiBody", label: "Use AI Body from Input", type: "boolean", defaultValue: false },
    { key: "attachmentsPath", label: "Attachments Path", type: "text", placeholder: "files" },
    { key: "previewOnly", label: "Preview Only", type: "boolean", defaultValue: false },
    { key: "messageId", label: "Message ID", type: "text", placeholder: "{{email.id}}" },
    { key: "includeBody", label: "Include Body", type: "boolean", defaultValue: true },
    { key: "senderFilter", label: "Sender Filter", type: "text" },
    { key: "subjectKeywords", label: "Subject Keywords", type: "text" },
    { key: "labels", label: "Labels", type: "text", defaultValue: "INBOX" },
    { key: "unreadOnly", label: "Unread Only", type: "boolean", defaultValue: true },
    { key: "dateFrom", label: "Date From", type: "text" },
    { key: "dateTo", label: "Date To", type: "text" },
    { key: "pollIntervalMinutes", label: "Poll Interval (minutes)", type: "number", defaultValue: 5 },
    { key: "realtime", label: "Real-time Monitoring", type: "boolean", defaultValue: false },
    { key: "maxResults", label: "Max Emails", type: "number", defaultValue: 10 },
  ],
  defaultConfig: {
    action: "send",
    connectionId: "",
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    bodyFormat: "plain",
    body: "",
    useAiBody: false,
    attachmentsPath: "",
    previewOnly: false,
    messageId: "",
    includeBody: true,
    senderFilter: "",
    subjectKeywords: "",
    labels: "INBOX",
    unreadOnly: true,
    dateFrom: "",
    dateTo: "",
    pollIntervalMinutes: 5,
    realtime: false,
    maxResults: 10,
  },
  isMutating: true,
  execute: async ({ config, inputs, context }) => {
    const variables = { ...context.variables, ...inputs };
    const action = getAction(config);
    if (action === "read") {
      return executeRead(config, variables, inputs, context.isSimulation);
    }
    if (action === "monitor") {
      return executeMonitor(config, context.isSimulation);
    }
    return executeSend(config, variables, inputs, context.isSimulation);
  },
};

export const gmailNodePlugins: readonly NodePlugin[] = [gmailPlugin];
