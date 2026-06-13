import { v4 as uuidv4 } from "uuid";

export type AuditAction =
  | "workflow.created"
  | "workflow.updated"
  | "workflow.deleted"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "secret.accessed"
  | "policy.violation"
  | "integration.oauth.started"
  | "integration.oauth.completed"
  | "integration.disconnected";

export interface AuditEntry {
  readonly id: string;
  readonly action: AuditAction;
  readonly actorId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

class AuditTrail {
  private entries: AuditEntry[] = [];

  record(
    action: AuditAction,
    actorId: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
  ): AuditEntry {
    const entry: AuditEntry = {
      id: uuidv4(),
      action,
      actorId,
      resourceType,
      resourceId,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  getAll(): readonly AuditEntry[] {
    return [...this.entries].reverse();
  }

  getByResource(resourceType: string, resourceId: string): readonly AuditEntry[] {
    return this.entries.filter(
      (entry) => entry.resourceType === resourceType && entry.resourceId === resourceId,
    );
  }
}

export const auditTrail = new AuditTrail();
