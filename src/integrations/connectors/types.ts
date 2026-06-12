export type ConnectorType = "http" | "sql" | "saas";

export interface ConnectorRequest {
  readonly connectorType: ConnectorType;
  readonly credentialId?: string;
  readonly scope: string;
  readonly payload: Record<string, unknown>;
  readonly isSimulation: boolean;
}

export interface ConnectorResponse {
  readonly success: boolean;
  readonly data: Record<string, unknown>;
  readonly error?: string;
  readonly simulated?: boolean;
}

export interface ConnectorGateway {
  execute: (request: ConnectorRequest) => Promise<ConnectorResponse>;
}
