import type { GmailMonitoringRules } from "@/src/integrations/types";

export interface GmailMessageMetadata {
  readonly id: string;
  readonly threadId: string;
  readonly snippet: string;
  readonly labelIds: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly date: string;
  readonly isUnread: boolean;
}

export interface GmailMessageContent extends GmailMessageMetadata {
  readonly bodyText: string;
  readonly bodyHtml: string;
}

export interface GmailAttachment {
  readonly filename: string;
  readonly mimeType: string;
  readonly contentBase64: string;
}

export interface GmailSendEmailInput {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly bodyText?: string;
  readonly bodyHtml?: string;
  readonly attachments?: readonly GmailAttachment[];
  readonly previewOnly?: boolean;
}

export interface GmailSendEmailResult {
  readonly messageId?: string;
  readonly preview?: {
    readonly to: readonly string[];
    readonly cc: readonly string[];
    readonly bcc: readonly string[];
    readonly subject: string;
    readonly bodyText: string;
    readonly bodyHtml: string;
    readonly attachments: readonly string[];
  };
}

interface GmailListResponse {
  readonly messages?: readonly { readonly id: string; readonly threadId: string }[];
  readonly resultSizeEstimate?: number;
}

interface GmailMessageResponse {
  readonly id: string;
  readonly threadId: string;
  readonly snippet: string;
  readonly labelIds?: readonly string[];
  readonly payload?: {
    readonly headers?: readonly { readonly name: string; readonly value: string }[];
    readonly parts?: readonly GmailMessagePart[];
    readonly body?: { readonly data?: string };
    readonly mimeType?: string;
  };
}

interface GmailMessagePart {
  readonly mimeType?: string;
  readonly body?: { readonly data?: string };
  readonly parts?: readonly GmailMessagePart[];
}

function getHeader(headers: readonly { readonly name: string; readonly value: string }[] | undefined, name: string): string {
  const header = headers?.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractBody(payload: GmailMessageResponse["payload"]): { bodyText: string; bodyHtml: string } {
  if (!payload) {
    return { bodyText: "", bodyHtml: "" };
  }
  let bodyText = "";
  let bodyHtml = "";
  function walk(part: GmailMessagePart): void {
    const mimeType = part.mimeType ?? "";
    const data = part.body?.data;
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType === "text/plain" && !bodyText) {
        bodyText = decoded;
      }
      if (mimeType === "text/html" && !bodyHtml) {
        bodyHtml = decoded;
      }
    }
    part.parts?.forEach(walk);
  }
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
  }
  payload.parts?.forEach(walk);
  return { bodyText, bodyHtml };
}

export function buildGmailSearchQuery(rules: Partial<GmailMonitoringRules>): string {
  const parts: string[] = [];
  if (rules.senderFilter?.trim()) {
    parts.push(`from:(${rules.senderFilter.trim()})`);
  }
  if (rules.subjectKeywords?.trim()) {
    parts.push(`subject:(${rules.subjectKeywords.trim()})`);
  }
  if (rules.labels?.trim()) {
    const labels = rules.labels.split(",").map((label) => label.trim()).filter(Boolean);
    for (const label of labels) {
      parts.push(`label:${label}`);
    }
  }
  if (rules.unreadOnly) {
    parts.push("is:unread");
  }
  if (rules.dateFrom?.trim()) {
    parts.push(`after:${rules.dateFrom.trim()}`);
  }
  if (rules.dateTo?.trim()) {
    parts.push(`before:${rules.dateTo.trim()}`);
  }
  if (parts.length === 0) {
    return "in:inbox";
  }
  return parts.join(" ");
}

function toMetadata(message: GmailMessageResponse): GmailMessageMetadata {
  const headers = message.payload?.headers ?? [];
  const labelIds = message.labelIds ?? [];
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
    labelIds,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    isUnread: labelIds.includes("UNREAD"),
  };
}

function chunkBase64(value: string): string {
  return (value.match(/.{1,76}/g) ?? [value]).join("\r\n");
}

function buildBodySection(input: GmailSendEmailInput): { contentType: string; content: string } {
  const hasHtml = Boolean(input.bodyHtml?.trim());
  const hasText = Boolean(input.bodyText?.trim());
  if (hasHtml && hasText) {
    const boundary = `alt_${Date.now()}`;
    const content = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      input.bodyText ?? "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      input.bodyHtml ?? "",
      `--${boundary}--`,
    ].join("\r\n");
    return { contentType: `multipart/alternative; boundary="${boundary}"`, content };
  }
  if (hasHtml) {
    return { contentType: "text/html; charset=UTF-8", content: input.bodyHtml ?? "" };
  }
  return { contentType: "text/plain; charset=UTF-8", content: input.bodyText ?? "" };
}

function buildRawEmail(input: GmailSendEmailInput): string {
  const headerLines = [
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : "",
    input.bcc?.length ? `Bcc: ${input.bcc.join(", ")}` : "",
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);
  const attachments = input.attachments ?? [];
  const bodySection = buildBodySection(input);
  if (attachments.length === 0) {
    return [...headerLines, `Content-Type: ${bodySection.contentType}`, "", bodySection.content].join("\r\n");
  }
  const boundary = `mixed_${Date.now()}`;
  const parts: string[] = [
    `--${boundary}`,
    `Content-Type: ${bodySection.contentType}`,
    "",
    bodySection.content,
  ];
  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType || "application/octet-stream"}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      chunkBase64(attachment.contentBase64),
    );
  }
  parts.push(`--${boundary}--`);
  return [...headerLines, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", ...parts].join("\r\n");
}

export class GmailApiClient {
  constructor(private readonly accessToken: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const data = (await response.json()) as T & { error?: { message?: string; code?: number } };
    if (!response.ok) {
      const message = data.error?.message ?? `Gmail API error (${response.status})`;
      const error = new Error(message) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }
    return data;
  }

  async listMessages(query: string, maxResults = 10): Promise<readonly GmailMessageMetadata[]> {
    const list = await this.request<GmailListResponse>(
      `/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
    );
    if (!list.messages?.length) {
      return [];
    }
    const messages = await Promise.all(
      list.messages.map(async (item) => {
        const message = await this.request<GmailMessageResponse>(
          `/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        );
        return toMetadata(message);
      }),
    );
    return messages;
  }

  async getMessage(messageId: string, includeBody = true): Promise<GmailMessageContent> {
    const format = includeBody ? "full" : "metadata";
    const message = await this.request<GmailMessageResponse>(`/messages/${messageId}?format=${format}`);
    const metadata = toMetadata(message);
    const body = includeBody ? extractBody(message.payload) : { bodyText: "", bodyHtml: "" };
    return { ...metadata, ...body };
  }

  async sendEmail(input: GmailSendEmailInput): Promise<GmailSendEmailResult> {
    const preview = {
      to: input.to,
      cc: input.cc ?? [],
      bcc: input.bcc ?? [],
      subject: input.subject,
      bodyText: input.bodyText ?? "",
      bodyHtml: input.bodyHtml ?? "",
      attachments: (input.attachments ?? []).map((attachment) => attachment.filename),
    };
    if (input.previewOnly) {
      return { preview };
    }
    const raw = buildRawEmail(input);
    const encoded = Buffer.from(raw).toString("base64url");
    const result = await this.request<{ id: string }>("/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw: encoded }),
    });
    return { messageId: result.id, preview };
  }
}
