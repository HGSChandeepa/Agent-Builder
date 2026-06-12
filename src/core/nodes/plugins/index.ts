import Groq from "groq-sdk";
import type { NodePlugin } from "@/src/core/nodes/types";
import { connectorGateway } from "@/src/integrations/connectors/gateway";

const TRIGGER_OUTPUT = [{ id: "output", label: "Output", dataType: "trigger" as const }];
const DEFAULT_INPUT = [{ id: "input", label: "Input", dataType: "any" as const }];
const DEFAULT_OUTPUT = [{ id: "output", label: "Output", dataType: "any" as const }];
const DEFAULT_LLM_MODEL = "openai/gpt-oss-120b";
const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";
const DEFAULT_MAX_COMPLETION_TOKENS = 1024;
const MAX_GROQ_ON_DEMAND_COMPLETION_TOKENS = 2048;
const LLM_REQUIRES_PROMPT_TEMPLATE_MESSAGE =
  "LLM Call needs a Prompt Template connected directly before it. Add a Prompt Template block and connect its output to the LLM Call input.";

type StructuredOutputFormat = "text" | "json";
type ReasoningEffort = "low" | "medium" | "high";

interface StructuredOutputField {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
}

function resolveTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value !== undefined ? String(value) : "";
  });
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

function stringifyPromptValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function resolveUserPrompt(config: Record<string, unknown>, variables: Record<string, unknown>): string {
  const source = String(config.userPromptSource ?? "typed");
  if (source !== "input") {
    return resolveTemplate(String(config.userPrompt ?? ""), variables);
  }
  const inputPath = String(config.userPromptInputPath ?? "").trim();
  const inputValue = getValueByPath(variables, inputPath);
  const prompt = stringifyPromptValue(inputValue);
  if (!prompt) {
    throw new Error(`Prompt Template could not find user prompt input at "${inputPath}".`);
  }
  return prompt;
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, headerValue]) => key.trim().length > 0 && headerValue !== undefined && headerValue !== null)
      .map(([key, headerValue]) => [key.trim(), String(headerValue)]),
  );
}

function getStructuredOutputFormat(value: unknown): StructuredOutputFormat {
  return value === "json" ? "json" : "text";
}

function getReasoningEffort(value: unknown): ReasoningEffort {
  if (value === "low" || value === "high") {
    return value;
  }
  return DEFAULT_REASONING_EFFORT;
}

function getMaxCompletionTokens(value: unknown): number {
  const tokens = Number(value ?? DEFAULT_MAX_COMPLETION_TOKENS);
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return DEFAULT_MAX_COMPLETION_TOKENS;
  }
  return Math.min(Math.floor(tokens), MAX_GROQ_ON_DEMAND_COMPLETION_TOKENS);
}

function getStructuredOutputFields(value: unknown): StructuredOutputField[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((field) => {
      const record = field as Record<string, unknown>;
      return {
        name: String(record.name ?? "").trim(),
        type: String(record.type ?? "string").trim() || "string",
        description: String(record.description ?? "").trim(),
        required: Boolean(record.required ?? true),
      };
    })
    .filter((field) => field.name.length > 0);
}

function buildStructuredOutputInstruction(
  outputFormat: StructuredOutputFormat,
  fields: readonly StructuredOutputField[],
): string {
  if (outputFormat !== "json") {
    return "Return a concise text response.";
  }
  const fieldLines = fields.map((field) => {
    const requiredLabel = field.required ? "required" : "optional";
    const description = field.description ? ` - ${field.description}` : "";
    return `- ${field.name}: ${field.type}, ${requiredLabel}${description}`;
  });
  if (fieldLines.length === 0) {
    return "Return only a valid JSON object. Do not include markdown fences or explanatory text.";
  }
  return [
    "Return only a valid JSON object. Do not include markdown fences or explanatory text.",
    "The JSON object must use these fields:",
    ...fieldLines,
  ].join("\n");
}

function parseJsonResponse(response: string): Record<string, unknown> {
  const parsed = JSON.parse(response) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("LLM returned JSON, but it was not an object.");
  }
  return parsed as Record<string, unknown>;
}

function createSimulatedStructuredOutput(fields: readonly StructuredOutputField[]): Record<string, unknown> {
  if (fields.length === 0) {
    return { response: "Simulated structured response" };
  }
  return Object.fromEntries(
    fields.map((field) => {
      if (field.type === "number") {
        return [field.name, 1];
      }
      if (field.type === "boolean") {
        return [field.name, true];
      }
      if (field.type === "array") {
        return [field.name, []];
      }
      if (field.type === "object") {
        return [field.name, {}];
      }
      return [field.name, `Simulated ${field.name}`];
    }),
  );
}

function getPromptMessages(inputs: Record<string, unknown>): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = typeof inputs.systemPrompt === "string" ? inputs.systemPrompt.trim() : "";
  const userPrompt = typeof inputs.userPrompt === "string" ? inputs.userPrompt.trim() : "";
  if (!userPrompt) {
    throw new Error(LLM_REQUIRES_PROMPT_TEMPLATE_MESSAGE);
  }
  return { systemPrompt, userPrompt };
}

function createGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for live LLM calls. Add it to your local environment and run again.");
  }
  return new Groq({ apiKey });
}

export const manualTriggerPlugin: NodePlugin = {
  type: "ManualTrigger",
  label: "Manual Trigger",
  description: "Start workflow manually from the UI",
  category: "trigger",
  icon: "play",
  color: "#10b981",
  inputPorts: [],
  outputPorts: TRIGGER_OUTPUT,
  configFields: [],
  defaultConfig: {},
  execute: async ({ inputs, context }) => ({
    output: { ...context.variables, ...inputs },
    logs: [{ level: "info", message: "Manual trigger activated" }],
  }),
};

export const httpRequestPlugin: NodePlugin = {
  type: "HttpRequest",
  label: "HTTP Request",
  description: "Make REST/GraphQL requests to external APIs",
  category: "data",
  icon: "globe",
  color: "#3b82f6",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "method", label: "Method", type: "select", required: true, defaultValue: "GET", options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "PATCH", value: "PATCH" },
      { label: "DELETE", value: "DELETE" },
    ]},
    { key: "url", label: "URL", type: "text", required: true, placeholder: "https://api.example.com/data" },
    { key: "headers", label: "Headers (JSON)", type: "json", defaultValue: {} },
    { key: "body", label: "Body (JSON)", type: "json", defaultValue: {} },
  ],
  defaultConfig: { method: "GET", url: "", headers: {}, body: {} },
  execute: async ({ config, inputs, context }) => {
    const method = String(config.method ?? "GET");
    const url = resolveTemplate(String(config.url ?? ""), { ...context.variables, ...inputs });
    const headers = normalizeHeaders(config.headers);
    const response = await connectorGateway.execute({
      connectorType: "http",
      scope: method === "GET" ? "http:read" : "http:write",
      isSimulation: context.isSimulation,
      payload: { method, url, headers, body: config.body },
    });
    if (!response.success) {
      return {
        output: { error: response.error, response: response.data },
        logs: [{ level: "error", message: response.error ?? "HTTP request failed" }],
      };
    }
    const data = response.data.body ?? response.data;
    const status = Number(response.data.status ?? 200);
    return {
      output: {
        status,
        headers: response.data.headers ?? {},
        body: response.data.body,
        rawBody: response.data.rawBody,
        data,
        response: response.data,
        simulated: response.simulated ?? false,
      },
      logs: [{ level: "info", message: `${method} ${url} -> ${status}${response.simulated ? " (simulated)" : ""}` }],
      metrics: [{ name: "http.status", value: status }],
    };
  },
};

export const sqlQueryPlugin: NodePlugin = {
  type: "SqlQuery",
  label: "SQL Query",
  description: "Execute parameterized SQL queries",
  category: "data",
  icon: "database",
  color: "#8b5cf6",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "connectionId", label: "Connection ID", type: "text", required: true },
    { key: "query", label: "SQL Query", type: "textarea", required: true, placeholder: "SELECT * FROM users WHERE id = :id" },
    { key: "parameters", label: "Parameters (JSON)", type: "json", defaultValue: {} },
    { key: "allowWrite", label: "Allow Write", type: "boolean", defaultValue: false },
  ],
  defaultConfig: { connectionId: "", query: "", parameters: {}, allowWrite: false },
  execute: async ({ config, inputs, context }) => {
    const query = String(config.query ?? "");
    const parameters = { ...(config.parameters as Record<string, unknown>), ...inputs };
    const allowWrite = Boolean(config.allowWrite);
    const response = await connectorGateway.execute({
      connectorType: "sql",
      credentialId: String(config.connectionId ?? ""),
      scope: allowWrite ? "sql:write" : "sql:read",
      isSimulation: context.isSimulation,
      payload: { query, parameters, allowWrite },
    });
    if (!response.success) {
      return {
        output: { error: response.error, rows: [], rowCount: 0 },
        logs: [{ level: "error", message: response.error ?? "SQL query failed" }],
      };
    }
    return {
      output: response.data,
      logs: [{ level: "info", message: `SQL executed: ${query.slice(0, 80)}${response.simulated ? " (simulated)" : ""}` }],
    };
  },
};

export const promptTemplatePlugin: NodePlugin = {
  type: "PromptTemplate",
  label: "Prompt Template",
  description: "Compose structured prompts with variables",
  category: "ai",
  icon: "file-text",
  color: "#ec4899",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "systemPrompt", label: "System Prompt", type: "textarea", placeholder: "You are a helpful assistant..." },
    { key: "userPromptSource", label: "User Prompt Source", type: "select", defaultValue: "typed", options: [
      { label: "Typed prompt", value: "typed" },
      { label: "Input field", value: "input" },
    ]},
    { key: "userPromptInputPath", label: "Input Field Path", type: "text", placeholder: "response.body.message" },
    { key: "userPrompt", label: "User Prompt", type: "textarea", required: true, placeholder: "Analyze {{input}}" },
  ],
  defaultConfig: { systemPrompt: "", userPromptSource: "typed", userPromptInputPath: "", userPrompt: "" },
  execute: async ({ config, inputs, context }) => {
    const variables = { ...context.variables, ...inputs };
    const systemPrompt = resolveTemplate(String(config.systemPrompt ?? ""), variables);
    const userPrompt = resolveUserPrompt(config, variables);
    return {
      output: { systemPrompt, userPrompt, prompt: `${systemPrompt}\n\n${userPrompt}`.trim() },
      logs: [{ level: "info", message: "Prompt template composed" }],
    };
  },
};

export const llmCallPlugin: NodePlugin = {
  type: "LlmCall",
  label: "LLM Call",
  description: "Call a language model with prompt",
  category: "ai",
  icon: "brain",
  color: "#f59e0b",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "model", label: "Model", type: "select", defaultValue: DEFAULT_LLM_MODEL, options: [
      { label: "GPT OSS 120B", value: "openai/gpt-oss-120b" },
      { label: "GPT OSS 20B", value: "openai/gpt-oss-20b" },
      { label: "Qwen 3 32B", value: "qwen/qwen3-32b" },
    ]},
    { key: "reasoningEffort", label: "Reasoning", type: "select", defaultValue: DEFAULT_REASONING_EFFORT, options: [
      { label: "Low", value: "low" },
      { label: "Medium", value: "medium" },
      { label: "High", value: "high" },
    ]},
    { key: "temperature", label: "Temperature", type: "number", defaultValue: 1 },
    { key: "maxTokens", label: "Max Completion Tokens", type: "number", defaultValue: DEFAULT_MAX_COMPLETION_TOKENS },
  ],
  defaultConfig: {
    model: DEFAULT_LLM_MODEL,
    reasoningEffort: DEFAULT_REASONING_EFFORT,
    temperature: 1,
    maxTokens: DEFAULT_MAX_COMPLETION_TOKENS,
    outputFormat: "text",
    structuredFields: [],
  },
  execute: async ({ config, inputs, context }) => {
    const { systemPrompt, userPrompt } = getPromptMessages(inputs);
    const model = String(config.model ?? DEFAULT_LLM_MODEL);
    const temperature = Number(config.temperature ?? 1);
    const maxTokens = getMaxCompletionTokens(config.maxTokens);
    const configuredMaxTokens = Number(config.maxTokens ?? DEFAULT_MAX_COMPLETION_TOKENS);
    const wasMaxTokensCapped = Number.isFinite(configuredMaxTokens) && configuredMaxTokens > maxTokens;
    const reasoningEffort = getReasoningEffort(config.reasoningEffort);
    const outputFormat = getStructuredOutputFormat(config.outputFormat);
    const structuredFields = getStructuredOutputFields(config.structuredFields);
    const structuredInstruction = buildStructuredOutputInstruction(outputFormat, structuredFields);
    const systemContent = [systemPrompt, structuredInstruction].filter(Boolean).join("\n\n");
    const messages = [
      ...(systemContent ? [{ role: "system" as const, content: systemContent }] : []),
      { role: "user" as const, content: userPrompt },
    ];
    if (context.isSimulation) {
      const structuredOutput =
        outputFormat === "json" ? createSimulatedStructuredOutput(structuredFields) : undefined;
      const response = structuredOutput
        ? JSON.stringify(structuredOutput, null, 2)
        : `[Simulated ${model}] Response to: ${userPrompt.slice(0, 100)}...`;
      return {
        output: {
          response,
          structuredOutput,
          outputFormat,
          model,
          usage: { promptTokens: userPrompt.length + systemContent.length, completionTokens: 50 },
        },
        logs: [
          ...(wasMaxTokensCapped
            ? [{ level: "warn" as const, message: `Max completion tokens capped at ${maxTokens} for Groq on-demand limits` }]
            : []),
          { level: "info", message: `[Simulation] LLM call with ${model}` },
        ],
        metrics: [{ name: "llm.tokens", value: userPrompt.length + systemContent.length + 50 }],
      };
    }
    const groq = createGroqClient();
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model,
      temperature,
      max_completion_tokens: maxTokens,
      top_p: 1,
      reasoning_effort: reasoningEffort,
      stop: null,
      ...(outputFormat === "json" ? { response_format: { type: "json_object" as const } } : {}),
    });
    const response = chatCompletion.choices[0]?.message?.content ?? "";
    const structuredOutput = outputFormat === "json" ? parseJsonResponse(response) : undefined;
    const totalTokens = chatCompletion.usage?.total_tokens ?? 0;
    return {
      output: {
        response,
        structuredOutput,
        outputFormat,
        model,
        usage: chatCompletion.usage ?? { promptTokens: 0, completionTokens: 0 },
      },
      logs: [
        ...(wasMaxTokensCapped
          ? [{ level: "warn" as const, message: `Max completion tokens capped at ${maxTokens} for Groq on-demand limits` }]
          : []),
        { level: "info", message: `LLM call completed with ${model}` },
      ],
      metrics: totalTokens > 0 ? [{ name: "llm.tokens", value: totalTokens }] : [],
    };
  },
};

export const ifElsePlugin: NodePlugin = {
  type: "IfElse",
  label: "If / Else",
  description: "Branch based on a condition",
  category: "control",
  icon: "git-branch",
  color: "#6366f1",
  inputPorts: DEFAULT_INPUT,
  outputPorts: [
    { id: "true", label: "True", dataType: "any" },
    { id: "false", label: "False", dataType: "any" },
  ],
  configFields: [
    { key: "field", label: "Field", type: "text", required: true, placeholder: "status" },
    { key: "operator", label: "Operator", type: "select", defaultValue: "equals", options: [
      { label: "Equals", value: "equals" },
      { label: "Not Equals", value: "not_equals" },
      { label: "Contains", value: "contains" },
      { label: "Greater Than", value: "gt" },
      { label: "Less Than", value: "lt" },
    ]},
    { key: "value", label: "Value", type: "text", required: true },
  ],
  defaultConfig: { field: "", operator: "equals", value: "" },
  execute: async ({ config, inputs }) => {
    const field = String(config.field ?? "");
    const operator = String(config.operator ?? "equals");
    const expected = config.value;
    const actual = inputs[field] ?? (inputs.data as Record<string, unknown>)?.[field];
    let result = false;
    switch (operator) {
      case "equals":
        result = String(actual) === String(expected);
        break;
      case "not_equals":
        result = String(actual) !== String(expected);
        break;
      case "contains":
        result = String(actual).includes(String(expected));
        break;
      case "gt":
        result = Number(actual) > Number(expected);
        break;
      case "lt":
        result = Number(actual) < Number(expected);
        break;
    }
    return {
      output: inputs,
      branch: result ? "true" : "false",
      logs: [{ level: "info", message: `Condition ${field} ${operator} ${expected}: ${result}` }],
    };
  },
};

export const forEachPlugin: NodePlugin = {
  type: "ForEach",
  label: "For Each",
  description: "Iterate over a list of items",
  category: "control",
  icon: "repeat",
  color: "#14b8a6",
  inputPorts: DEFAULT_INPUT,
  outputPorts: [
    { id: "item", label: "Item", dataType: "any" },
    { id: "done", label: "Done", dataType: "any" },
  ],
  configFields: [
    { key: "arrayField", label: "Array Field", type: "text", required: true, defaultValue: "items" },
  ],
  defaultConfig: { arrayField: "items" },
  execute: async ({ config, inputs }) => {
    const arrayField = String(config.arrayField ?? "items");
    const items = (inputs[arrayField] ?? inputs.rows ?? []) as unknown[];
    if (!Array.isArray(items)) {
      return {
        output: { error: "Input is not an array", items: [] },
        branch: "done",
        logs: [{ level: "error", message: `Field ${arrayField} is not an array` }],
      };
    }
    return {
      output: { items, count: items.length, currentItem: items[0] },
      branch: items.length > 0 ? "item" : "done",
      logs: [{ level: "info", message: `Processing ${items.length} items` }],
    };
  },
};

export const transformPlugin: NodePlugin = {
  type: "Transform",
  label: "Transform",
  description: "Map and shape payload data",
  category: "output",
  icon: "shuffle",
  color: "#64748b",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "mapping", label: "Field Mapping (JSON)", type: "json", required: true, defaultValue: {} },
  ],
  defaultConfig: { mapping: {} },
  execute: async ({ config, inputs }) => {
    const mapping = (config.mapping ?? {}) as Record<string, string>;
    const output: Record<string, unknown> = {};
    for (const [targetKey, sourceKey] of Object.entries(mapping)) {
      output[targetKey] = inputs[sourceKey] ?? (inputs.data as Record<string, unknown>)?.[sourceKey];
    }
    return {
      output: Object.keys(output).length > 0 ? output : inputs,
      logs: [{ level: "info", message: `Transformed ${Object.keys(output).length} fields` }],
    };
  },
};

export const createOrUpdateRecordPlugin: NodePlugin = {
  type: "CreateOrUpdateRecord",
  label: "Create/Update Record",
  description: "Mutate CRM or ticket records",
  category: "action",
  icon: "edit",
  color: "#ef4444",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "connector", label: "Connector", type: "select", required: true, options: [
      { label: "Salesforce", value: "salesforce" },
      { label: "HubSpot", value: "hubspot" },
      { label: "Zendesk", value: "zendesk" },
    ]},
    { key: "objectType", label: "Object Type", type: "text", required: true, placeholder: "Contact" },
    { key: "operation", label: "Operation", type: "select", defaultValue: "create", options: [
      { label: "Create", value: "create" },
      { label: "Update", value: "update" },
    ]},
    { key: "fields", label: "Fields (JSON)", type: "json", defaultValue: {} },
  ],
  defaultConfig: { connector: "hubspot", objectType: "Contact", operation: "create", fields: {} },
  isMutating: true,
  execute: async ({ config, inputs, context }) => {
    const connector = String(config.connector ?? "hubspot");
    const objectType = String(config.objectType ?? "Contact");
    const operation = String(config.operation ?? "create");
    const fields = { ...(config.fields as Record<string, unknown>), ...inputs };
    const payload = { connector, objectType, operation, fields };
    if (context.isSimulation) {
      return {
        output: { id: "sim-123", ...payload, simulated: true },
        logs: [{ level: "info", message: `[Simulation] ${operation} ${objectType} via ${connector}` }],
      };
    }
    return {
      output: payload,
      requiresApproval: true,
      approvalPayload: payload,
      logs: [{ level: "info", message: `Awaiting approval for ${operation} ${objectType}` }],
    };
  },
};

export const approvalGatePlugin: NodePlugin = {
  type: "ApprovalGate",
  label: "Approval Gate",
  description: "Require human approval before proceeding",
  category: "governance",
  icon: "shield-check",
  color: "#dc2626",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "actionLabel", label: "Action Label", type: "text", required: true, defaultValue: "Approve Action" },
    { key: "autoApproveInDev", label: "Auto-approve in Dev", type: "boolean", defaultValue: true },
  ],
  defaultConfig: { actionLabel: "Approve Action", autoApproveInDev: true },
  execute: async ({ config, inputs, context }) => {
    const actionLabel = String(config.actionLabel ?? "Approve Action");
    const autoApprove = Boolean(config.autoApproveInDev) && context.environment === "development";
    if (autoApprove || context.isSimulation) {
      return {
        output: { ...inputs, approved: true, autoApproved: autoApprove },
        logs: [{ level: "info", message: autoApprove ? "Auto-approved in development" : "Approved in simulation" }],
      };
    }
    return {
      output: inputs,
      requiresApproval: true,
      approvalPayload: { actionLabel, data: inputs },
      logs: [{ level: "info", message: `Approval required: ${actionLabel}` }],
    };
  },
};

export const policyCheckPlugin: NodePlugin = {
  type: "PolicyCheck",
  label: "Policy Check",
  description: "Validate data against DLP and security policies",
  category: "governance",
  icon: "shield",
  color: "#7c3aed",
  inputPorts: DEFAULT_INPUT,
  outputPorts: [
    { id: "pass", label: "Pass", dataType: "any" },
    { id: "fail", label: "Fail", dataType: "any" },
  ],
  configFields: [
    { key: "blockPii", label: "Block PII", type: "boolean", defaultValue: true },
    { key: "allowedDomains", label: "Allowed Domains", type: "text", placeholder: "example.com,api.example.com" },
    { key: "maxPayloadSize", label: "Max Payload Size (KB)", type: "number", defaultValue: 512 },
  ],
  defaultConfig: { blockPii: true, allowedDomains: "", maxPayloadSize: 512 },
  execute: async ({ config, inputs }) => {
    const blockPii = Boolean(config.blockPii);
    const payloadStr = JSON.stringify(inputs);
    const piiPattern = /\b[\w.-]+@[\w.-]+\.\w{2,}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const hasPii = piiPattern.test(payloadStr);
    const sizeKb = new Blob([payloadStr]).size / 1024;
    const maxSize = Number(config.maxPayloadSize ?? 512);
    if (blockPii && hasPii) {
      return {
        output: { ...inputs, policyViolation: "PII detected" },
        branch: "fail",
        logs: [{ level: "warn", message: "Policy check failed: PII detected" }],
      };
    }
    if (sizeKb > maxSize) {
      return {
        output: { ...inputs, policyViolation: "Payload too large" },
        branch: "fail",
        logs: [{ level: "warn", message: `Policy check failed: payload ${sizeKb.toFixed(1)}KB > ${maxSize}KB` }],
      };
    }
    return {
      output: inputs,
      branch: "pass",
      logs: [{ level: "info", message: "Policy check passed" }],
    };
  },
};

export const returnResponsePlugin: NodePlugin = {
  type: "ReturnResponse",
  label: "Return Response",
  description: "Define final workflow output",
  category: "output",
  icon: "flag",
  color: "#059669",
  inputPorts: DEFAULT_INPUT,
  outputPorts: [],
  configFields: [
    { key: "statusCode", label: "Status Code", type: "number", defaultValue: 200 },
    { key: "responseField", label: "Response Field", type: "text", placeholder: "Leave empty to pass all input" },
  ],
  defaultConfig: { statusCode: 200, responseField: "" },
  execute: async ({ config, inputs }) => {
    const responseField = String(config.responseField ?? "");
    const response = responseField ? inputs[responseField] : inputs;
    return {
      output: { response, statusCode: Number(config.statusCode ?? 200), isFinal: true },
      logs: [{ level: "info", message: "Workflow response prepared" }],
    };
  },
};

export const llmOutputPlugin: NodePlugin = {
  type: "LlmOutput",
  label: "LLM Output",
  description: "Display the final message returned by an LLM call",
  category: "output",
  icon: "message-square",
  color: "#f97316",
  inputPorts: DEFAULT_INPUT,
  outputPorts: [],
  configFields: [],
  defaultConfig: {},
  execute: async ({ inputs }) => {
    const response = typeof inputs.response === "string" ? inputs.response : "";
    if (!response) {
      return {
        output: {
          response: "",
          error: "LLM Output must be connected after an LLM Call block.",
          isFinal: true,
        },
        logs: [{ level: "error", message: "No LLM response found in the input" }],
      };
    }
    return {
      output: {
        response,
        structuredOutput: inputs.structuredOutput,
        outputFormat: inputs.outputFormat,
        model: inputs.model,
        isFinal: true,
      },
      logs: [{ level: "info", message: "LLM output prepared for visibility" }],
    };
  },
};

export const retryWithBackoffPlugin: NodePlugin = {
  type: "RetryWithBackoff",
  label: "Retry With Backoff",
  description: "Wrap execution with retry policy",
  category: "control",
  icon: "refresh-cw",
  color: "#0ea5e9",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "maxRetries", label: "Max Retries", type: "number", defaultValue: 3 },
    { key: "baseDelayMs", label: "Base Delay (ms)", type: "number", defaultValue: 1000 },
  ],
  defaultConfig: { maxRetries: 3, baseDelayMs: 1000 },
  execute: async ({ config, inputs }) => ({
    output: { ...inputs, retryPolicy: { maxRetries: config.maxRetries, baseDelayMs: config.baseDelayMs } },
    logs: [{ level: "info", message: `Retry policy: ${config.maxRetries} retries, ${config.baseDelayMs}ms base delay` }],
  }),
};

export const emitMetricPlugin: NodePlugin = {
  type: "EmitMetric",
  label: "Emit Metric",
  description: "Record custom telemetry metrics",
  category: "output",
  icon: "bar-chart",
  color: "#a855f7",
  inputPorts: DEFAULT_INPUT,
  outputPorts: DEFAULT_OUTPUT,
  configFields: [
    { key: "metricName", label: "Metric Name", type: "text", required: true, placeholder: "workflow.success" },
    { key: "metricValue", label: "Metric Value", type: "number", defaultValue: 1 },
    { key: "unit", label: "Unit", type: "text", placeholder: "count" },
  ],
  defaultConfig: { metricName: "workflow.success", metricValue: 1, unit: "count" },
  execute: async ({ config, inputs }) => {
    const metricName = String(config.metricName ?? "workflow.success");
    const metricValue = Number(config.metricValue ?? 1);
    const unit = String(config.unit ?? "count");
    return {
      output: inputs,
      metrics: [{ name: metricName, value: metricValue, unit }],
      logs: [{ level: "info", message: `Metric emitted: ${metricName}=${metricValue} ${unit}` }],
    };
  },
};

export const allNodePlugins: readonly NodePlugin[] = [
  manualTriggerPlugin,
  httpRequestPlugin,
  sqlQueryPlugin,
  promptTemplatePlugin,
  llmCallPlugin,
  ifElsePlugin,
  forEachPlugin,
  transformPlugin,
  createOrUpdateRecordPlugin,
  approvalGatePlugin,
  policyCheckPlugin,
  returnResponsePlugin,
  llmOutputPlugin,
  retryWithBackoffPlugin,
  emitMetricPlugin,
];
