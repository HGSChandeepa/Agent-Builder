export type CredentialType = "api_key" | "oauth2" | "basic" | "connection_string";

export interface CredentialProfile {
  readonly id: string;
  readonly name: string;
  readonly type: CredentialType;
  readonly scopes: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SecretValue {
  readonly credentialId: string;
  readonly key: string;
  readonly value: string;
}

export interface SecretAccessRequest {
  readonly credentialId: string;
  readonly scope: string;
  readonly requesterId: string;
}

export interface SecretAccessResult {
  readonly granted: boolean;
  readonly headers?: Record<string, string>;
  readonly connectionString?: string;
  readonly reason?: string;
}
