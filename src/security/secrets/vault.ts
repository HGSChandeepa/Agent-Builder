import { v4 as uuidv4 } from "uuid";
import type {
  CredentialProfile,
  SecretAccessRequest,
  SecretAccessResult,
  SecretValue,
} from "@/src/security/secrets/types";

class SecretsVault {
  private credentials = new Map<string, CredentialProfile>();
  private secrets = new Map<string, SecretValue[]>();

  createCredential(name: string, type: CredentialProfile["type"], scopes: string[]): CredentialProfile {
    const now = new Date().toISOString();
    const profile: CredentialProfile = {
      id: uuidv4(),
      name,
      type,
      scopes,
      createdAt: now,
      updatedAt: now,
    };
    this.credentials.set(profile.id, profile);
    this.secrets.set(profile.id, []);
    return profile;
  }

  setSecret(credentialId: string, key: string, value: string): boolean {
    const profile = this.credentials.get(credentialId);
    if (!profile) {
      return false;
    }
    const existing = this.secrets.get(credentialId) ?? [];
    const filtered = existing.filter((s) => s.key !== key);
    filtered.push({ credentialId, key, value });
    this.secrets.set(credentialId, filtered);
    return true;
  }

  getCredentials(): readonly CredentialProfile[] {
    return Array.from(this.credentials.values());
  }

  getCredential(id: string): CredentialProfile | undefined {
    return this.credentials.get(id);
  }

  resolveAccess(request: SecretAccessRequest): SecretAccessResult {
    const profile = this.credentials.get(request.credentialId);
    if (!profile) {
      return { granted: false, reason: "Credential not found" };
    }
    if (!profile.scopes.includes(request.scope) && !profile.scopes.includes("*")) {
      return { granted: false, reason: `Scope '${request.scope}' not authorized` };
    }
    const secrets = this.secrets.get(request.credentialId) ?? [];
    const headers: Record<string, string> = {};
    let connectionString: string | undefined;
    for (const secret of secrets) {
      if (secret.key === "Authorization" || secret.key.startsWith("X-")) {
        headers[secret.key] = secret.value;
      }
      if (secret.key === "connectionString") {
        connectionString = secret.value;
      }
      if (profile.type === "api_key" && secret.key === "apiKey") {
        headers["Authorization"] = `Bearer ${secret.value}`;
      }
    }
    return { granted: true, headers, connectionString };
  }
}

export const secretsVault = new SecretsVault();

export function seedDefaultCredentials(): void {
  if (secretsVault.getCredentials().length > 0) {
    return;
  }
  const apiCred = secretsVault.createCredential("Demo API Key", "api_key", ["http:read", "http:write"]);
  secretsVault.setSecret(apiCred.id, "apiKey", "demo-api-key-replace-in-production");
  const dbCred = secretsVault.createCredential("Demo Database", "connection_string", ["sql:read"]);
  secretsVault.setSecret(dbCred.id, "connectionString", "postgresql://localhost:5432/demo");
}
