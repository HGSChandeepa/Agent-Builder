import type { ConnectorGateway, ConnectorRequest, ConnectorResponse } from "@/src/integrations/connectors/types";
import { secretsVault } from "@/src/security/secrets/vault";

async function executeHttpConnector(request: ConnectorRequest): Promise<ConnectorResponse> {
  const method = String(request.payload.method ?? "GET");
  const url = String(request.payload.url ?? "");
  const bodyPayload = request.payload.body;
  if (request.isSimulation) {
    return {
      success: true,
      simulated: true,
      data: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { message: "Simulated HTTP response" },
        rawBody: JSON.stringify({ message: "Simulated HTTP response" }),
        url,
        method,
      },
    };
  }
  const headers: Record<string, string> = {
    ...(request.payload.headers as Record<string, string>),
  };
  if (request.credentialId) {
    const access = secretsVault.resolveAccess({
      credentialId: request.credentialId,
      scope: request.scope,
      requesterId: "connector-gateway",
    });
    if (!access.granted) {
      return { success: false, data: {}, error: access.reason };
    }
    Object.assign(headers, access.headers ?? {});
  }
  try {
    const body = bodyPayload !== undefined && method !== "GET" ? JSON.stringify(bodyPayload) : undefined;
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
    if (body && !hasContentType) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method,
      headers,
      body,
    });
    const rawBody = await response.text();
    const data = rawBody ? tryParseJson(rawBody) : null;
    return {
      success: response.ok,
      data: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: data,
        rawBody,
        url: response.url,
        method,
      },
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      success: false,
      data: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function executeSqlConnector(request: ConnectorRequest): Promise<ConnectorResponse> {
  const query = String(request.payload.query ?? "");
  const allowWrite = Boolean(request.payload.allowWrite);
  if (request.isSimulation) {
    return {
      success: true,
      simulated: true,
      data: { rows: [{ id: 1, simulated: true }], rowCount: 1, query },
    };
  }
  if (allowWrite && request.scope !== "sql:write") {
    return { success: false, data: {}, error: "Write operations require sql:write scope" };
  }
  if (request.credentialId) {
    const access = secretsVault.resolveAccess({
      credentialId: request.credentialId,
      scope: request.scope,
      requesterId: "connector-gateway",
    });
    if (!access.granted) {
      return { success: false, data: {}, error: access.reason };
    }
  }
  return {
    success: true,
    data: {
      rows: [],
      rowCount: 0,
      query,
      message: "Configure database driver for live SQL execution",
    },
  };
}

async function executeSaasConnector(request: ConnectorRequest): Promise<ConnectorResponse> {
  const provider = String(request.payload.provider ?? "hubspot");
  const operation = String(request.payload.operation ?? "read");
  if (request.isSimulation) {
    return {
      success: true,
      simulated: true,
      data: { provider, operation, record: { id: "sim-001" } },
    };
  }
  if (request.credentialId) {
    const access = secretsVault.resolveAccess({
      credentialId: request.credentialId,
      scope: `saas:${provider}`,
      requesterId: "connector-gateway",
    });
    if (!access.granted) {
      return { success: false, data: {}, error: access.reason };
    }
  }
  return {
    success: true,
    data: { provider, operation, message: `Configure ${provider} OAuth for live integration` },
  };
}

class DefaultConnectorGateway implements ConnectorGateway {
  async execute(request: ConnectorRequest): Promise<ConnectorResponse> {
    switch (request.connectorType) {
      case "http":
        return executeHttpConnector(request);
      case "sql":
        return executeSqlConnector(request);
      case "saas":
        return executeSaasConnector(request);
      default:
        return { success: false, data: {}, error: `Unknown connector type: ${request.connectorType}` };
    }
  }
}

export const connectorGateway = new DefaultConnectorGateway();
