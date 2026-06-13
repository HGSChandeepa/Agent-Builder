import { NextResponse } from "next/server";
import { ensurePlatformReady } from "@/src/lib/bootstrap";
import {
  readGmailMessage,
  sendGmailEmail,
  syncGmailInbox,
} from "@/src/integrations/providers/gmail/service";
import type { GmailMonitoringRules } from "@/src/integrations/types";
import { DEFAULT_GMAIL_MONITORING_RULES } from "@/src/integrations/types";

function getOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: Request): Promise<NextResponse> {
  ensurePlatformReady();
  const body = await request.json();
  const action = String(body.action ?? "");
  const connectionId = String(body.connectionId ?? "");
  const origin = getOrigin(request);
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }
  try {
    if (action === "sync") {
      const rules = { ...DEFAULT_GMAIL_MONITORING_RULES, ...(body.rules as Partial<GmailMonitoringRules>) };
      const maxResults = Number(body.maxResults ?? 10);
      const result = await syncGmailInbox(connectionId, origin, rules, maxResults);
      return NextResponse.json(result);
    }
    if (action === "read") {
      const messageId = String(body.messageId ?? "");
      if (!messageId) {
        return NextResponse.json({ error: "messageId is required" }, { status: 400 });
      }
      const includeBody = body.includeBody !== false;
      const message = await readGmailMessage(connectionId, origin, messageId, includeBody);
      return NextResponse.json({ message });
    }
    if (action === "send") {
      const attachments = Array.isArray(body.attachments)
        ? body.attachments
            .map((item: Record<string, unknown>) => ({
              filename: String(item.filename ?? item.name ?? ""),
              mimeType: String(item.mimeType ?? item.contentType ?? "application/octet-stream"),
              contentBase64: String(item.contentBase64 ?? item.content ?? ""),
            }))
            .filter((item: { filename: string; contentBase64: string }) => item.filename && item.contentBase64)
        : undefined;
      const result = await sendGmailEmail(connectionId, origin, {
        to: Array.isArray(body.to) ? body.to.map(String) : [String(body.to ?? "")],
        cc: Array.isArray(body.cc) ? body.cc.map(String) : undefined,
        bcc: Array.isArray(body.bcc) ? body.bcc.map(String) : undefined,
        subject: String(body.subject ?? ""),
        bodyText: body.bodyText ? String(body.bodyText) : undefined,
        bodyHtml: body.bodyHtml ? String(body.bodyHtml) : undefined,
        attachments: attachments && attachments.length ? attachments : undefined,
        previewOnly: Boolean(body.previewOnly),
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unsupported Gmail action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail action failed" },
      { status: 500 },
    );
  }
}
