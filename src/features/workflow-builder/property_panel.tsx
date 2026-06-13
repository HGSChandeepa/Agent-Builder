"use client";

import { useMemo, useState } from "react";
import type { NodeDefinition, WorkflowDefinition } from "@/src/core/workflow/types";
import { useBuilderStore } from "@/src/features/workflow-builder/builder_store";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { GmailNodeSection, isGmailNodeType } from "@/src/features/workflow-builder/gmail_node_section";

type StructuredOutputFormat = "text" | "json";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface HttpHeaderPair {
  readonly id: string;
  readonly key: string;
  readonly value: string;
}

interface HttpResponsePreview {
  readonly success: boolean;
  readonly error?: string;
  readonly data?: unknown;
}

interface PromptInputPathOption {
  readonly value: string;
  readonly label: string;
}

interface StructuredOutputField {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
}

interface StructuredOutputsSectionProps {
  readonly config: Record<string, unknown>;
  readonly externalFieldNames: readonly string[];
  readonly onConfigChange: (key: string, value: unknown) => void;
}

const STRUCTURED_OUTPUT_TYPES = ["string", "number", "boolean", "object", "array"];
const HTTP_METHODS: readonly HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const COMMON_INPUT_PATHS: readonly { readonly value: string; readonly label: string }[] = [
  { value: "message", label: "message" },
  { value: "input", label: "input" },
  { value: "data", label: "data" },
  { value: "response", label: "response" },
];

function getStructuredOutputFormat(value: unknown): StructuredOutputFormat {
  return value === "json" ? "json" : "text";
}

function resolveSelectValue(
  rawValue: unknown,
  options: readonly { readonly value: string }[] | undefined,
  fallbackValue?: unknown,
): string | null {
  const candidates = [
    rawValue === undefined || rawValue === null ? "" : String(rawValue),
    fallbackValue === undefined || fallbackValue === null ? "" : String(fallbackValue),
  ].filter((value) => value.length > 0);
  if (!options || options.length === 0) {
    return candidates[0] ?? null;
  }
  for (const candidate of candidates) {
    if (options.some((option) => option.value === candidate)) {
      return candidate;
    }
  }
  return options[0]?.value ?? null;
}

function getStructuredOutputFields(value: unknown): StructuredOutputField[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((field) => {
    const record = field as Record<string, unknown>;
    return {
      name: String(record.name ?? ""),
      type: String(record.type ?? "string"),
      description: String(record.description ?? ""),
      required: Boolean(record.required ?? true),
    };
  });
}

function createStructuredOutputField(index: number): StructuredOutputField {
  return {
    name: `field${index + 1}`,
    type: "string",
    description: "",
    required: true,
  };
}

function getHeadersFromConfig(value: unknown): HttpHeaderPair[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).map(([key, headerValue], index) => ({
    id: `header-${index}`,
    key,
    value: String(headerValue ?? ""),
  }));
}

function getHeadersRecord(headers: readonly HttpHeaderPair[]): Record<string, string> {
  return Object.fromEntries(
    headers
      .filter((header) => header.key.trim().length > 0)
      .map((header) => [header.key.trim(), header.value]),
  );
}

function getBodyText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

function getParsedBody(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }
  return JSON.parse(value);
}

function createHttpHeaderPair(index: number): HttpHeaderPair {
  return {
    id: `header-${Date.now()}-${index}`,
    key: "",
    value: "",
  };
}

function getNodeOutputPathOptions(node: NodeDefinition): readonly { readonly value: string; readonly label: string }[] {
  switch (node.type) {
    case "HttpRequest":
      return [
        { value: "body", label: "Parsed response body" },
        { value: "data", label: "Data alias" },
        { value: "rawBody", label: "Raw response body" },
        { value: "status", label: "Status code" },
        { value: "headers", label: "Response headers" },
        { value: "response", label: "Full HTTP response" },
        { value: "response.body", label: "Full response body" },
        { value: "response.rawBody", label: "Full response raw body" },
        { value: "response.status", label: "Full response status" },
        { value: "response.headers", label: "Full response headers" },
      ];
    case "LlmCall":
    case "LlmOutput":
      return [
        { value: "response", label: "LLM response" },
        { value: "structuredOutput", label: "Structured output" },
        { value: "outputFormat", label: "Output format" },
        { value: "model", label: "Model" },
      ];
    case "PromptTemplate":
      return [
        { value: "prompt", label: "Full prompt" },
        { value: "userPrompt", label: "User prompt" },
        { value: "systemPrompt", label: "System prompt" },
      ];
    case "SqlQuery":
      return [
        { value: "rows", label: "Rows" },
        { value: "rowCount", label: "Row count" },
      ];
    case "ForEach":
      return [
        { value: "items", label: "Items" },
        { value: "count", label: "Count" },
        { value: "currentItem", label: "Current item" },
      ];
    case "Gmail":
      return [
        { value: "emails", label: "Matched emails (monitor)" },
        { value: "count", label: "Email count (monitor)" },
        { value: "emails.0.id", label: "First email ID (monitor)" },
        { value: "emails.0.from", label: "First email sender (monitor)" },
        { value: "emails.0.subject", label: "First email subject (monitor)" },
        { value: "id", label: "Message ID (read)" },
        { value: "from", label: "From (read)" },
        { value: "subject", label: "Subject (read)" },
        { value: "bodyText", label: "Body text (read)" },
        { value: "messageId", label: "Sent message ID (send)" },
      ];
    default:
      return COMMON_INPUT_PATHS;
  }
}

function getPromptInputPathOptions(
  workflow: WorkflowDefinition,
  selectedNodeId: string,
): PromptInputPathOption[] {
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const incomingEdges = workflow.edges.filter((edge) => edge.targetNodeId === selectedNodeId);
  const optionsByPath = new Map<string, PromptInputPathOption>();
  for (const edge of incomingEdges) {
    const sourceNode = nodeMap.get(edge.sourceNodeId);
    if (!sourceNode) {
      continue;
    }
    const pathOptions = getNodeOutputPathOptions(sourceNode);
    for (const option of pathOptions) {
      if (optionsByPath.has(option.value)) {
        continue;
      }
      optionsByPath.set(option.value, {
        value: option.value,
        label: `${option.label} - ${sourceNode.label} (${sourceNode.type})`,
      });
    }
  }
  return Array.from(optionsByPath.values());
}

function ensureCurrentPromptPathOption(
  options: readonly PromptInputPathOption[],
  currentPath: string,
): PromptInputPathOption[] {
  if (!currentPath || options.some((option) => option.value === currentPath)) {
    return [...options];
  }
  return [{ value: currentPath, label: `${currentPath} - current custom path` }, ...options];
}

function collectAncestorNodes(workflow: WorkflowDefinition, nodeId: string): NodeDefinition[] {
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
  const parentsByNode = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const parents = parentsByNode.get(edge.targetNodeId) ?? [];
    parents.push(edge.sourceNodeId);
    parentsByNode.set(edge.targetNodeId, parents);
  }
  const visited = new Set<string>();
  const queue = [...(parentsByNode.get(nodeId) ?? [])];
  const ancestors: NodeDefinition[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (node) {
      ancestors.push(node);
    }
    for (const parentId of parentsByNode.get(currentId) ?? []) {
      if (!visited.has(parentId)) {
        queue.push(parentId);
      }
    }
  }
  return ancestors;
}

function getStructuredFieldPathOptions(
  node: NodeDefinition,
): readonly { readonly value: string; readonly label: string }[] {
  if (node.type !== "LlmCall" || node.config.outputFormat !== "json") {
    return [];
  }
  return getStructuredOutputFields(node.config.structuredFields)
    .filter((field) => field.name.trim().length > 0)
    .map((field) => ({
      value: field.name.trim(),
      label: `${field.name.trim()} (structured ${field.type})`,
    }));
}

function getAncestorOutputPathOptions(
  workflow: WorkflowDefinition,
  selectedNodeId: string,
): PromptInputPathOption[] {
  const ancestors = collectAncestorNodes(workflow, selectedNodeId);
  const optionsByPath = new Map<string, PromptInputPathOption>();
  for (const node of ancestors) {
    const pathOptions = [...getStructuredFieldPathOptions(node), ...getNodeOutputPathOptions(node)];
    for (const option of pathOptions) {
      if (optionsByPath.has(option.value)) {
        continue;
      }
      optionsByPath.set(option.value, {
        value: option.value,
        label: `${option.label} — ${node.label} (${node.type})`,
      });
    }
  }
  return Array.from(optionsByPath.values());
}

function collectExternalStructuredFieldNames(
  workflow: WorkflowDefinition,
  selectedNodeId: string,
): string[] {
  const names: string[] = [];
  for (const node of workflow.nodes) {
    if (node.id === selectedNodeId || node.type !== "LlmCall" || node.config.outputFormat !== "json") {
      continue;
    }
    for (const field of getStructuredOutputFields(node.config.structuredFields)) {
      names.push(field.name);
    }
  }
  return names;
}

async function testHttpRequest(config: Record<string, unknown>): Promise<HttpResponsePreview> {
  const response = await fetch("/api/connectors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectorType: "http",
      scope: config.method === "GET" ? "http:read" : "http:write",
      isSimulation: false,
      payload: config,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "HTTP test failed");
  }
  return data.response as HttpResponsePreview;
}

function HttpRequestSection({
  config,
  onConfigChange,
}: {
  readonly config: Record<string, unknown>;
  readonly onConfigChange: (key: string, value: unknown) => void;
}) {
  const [headers, setHeaders] = useState<HttpHeaderPair[]>(() => getHeadersFromConfig(config.headers));
  const [bodyText, setBodyText] = useState<string>(() => getBodyText(config.body));
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HttpResponsePreview | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const method = String(config.method ?? "GET") as HttpMethod;
  const url = String(config.url ?? "");
  const headerRecord = useMemo(() => getHeadersRecord(headers), [headers]);
  function handleHeaderChange(index: number, updates: Partial<HttpHeaderPair>): void {
    const nextHeaders = headers.map((header, headerIndex) =>
      headerIndex === index ? { ...header, ...updates } : header,
    );
    setHeaders(nextHeaders);
    onConfigChange("headers", getHeadersRecord(nextHeaders));
  }
  function handleAddHeader(): void {
    setHeaders([...headers, createHttpHeaderPair(headers.length)]);
  }
  function handleRemoveHeader(index: number): void {
    const nextHeaders = headers.filter((_, headerIndex) => headerIndex !== index);
    setHeaders(nextHeaders);
    onConfigChange("headers", getHeadersRecord(nextHeaders));
  }
  function handleBodyChange(value: string): void {
    setBodyText(value);
    try {
      const parsedBody = getParsedBody(value);
      setBodyError(null);
      onConfigChange("body", parsedBody ?? {});
    } catch {
      setBodyError("Body must be valid JSON.");
    }
  }
  async function handleTest(): Promise<void> {
    setTestResult(null);
    setTestError(null);
    if (!url.trim()) {
      setTestError("Enter a URL before testing.");
      return;
    }
    if (bodyError) {
      setTestError(bodyError);
      return;
    }
    setIsTesting(true);
    try {
      const result = await testHttpRequest({
        method,
        url,
        headers: headerRecord,
        body: getParsedBody(bodyText) ?? {},
      });
      setTestResult(result);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "HTTP test failed");
    } finally {
      setIsTesting(false);
    }
  }
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="http-method">Method</Label>
        <Select value={method} onValueChange={(value) => onConfigChange("method", value ?? "GET")}>
          <SelectTrigger id="http-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((httpMethod) => (
              <SelectItem key={httpMethod} value={httpMethod}>
                {httpMethod}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="http-url">URL</Label>
        <Input
          id="http-url"
          value={url}
          onChange={(event) => onConfigChange("url", event.target.value)}
          placeholder="https://api.example.com/data"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Headers</Label>
          <Button variant="outline" size="sm" onClick={handleAddHeader}>
            Add header
          </Button>
        </div>
        {headers.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            No headers added.
          </p>
        )}
        {headers.map((header, index) => (
          <div key={header.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={header.key}
              onChange={(event) => handleHeaderChange(index, { key: event.target.value })}
              placeholder="Header"
            />
            <Input
              value={header.value}
              onChange={(event) => handleHeaderChange(index, { value: event.target.value })}
              placeholder="Value"
            />
            <Button variant="ghost" size="sm" onClick={() => handleRemoveHeader(index)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="http-body">Body (JSON)</Label>
        <Textarea
          id="http-body"
          value={bodyText}
          onChange={(event) => handleBodyChange(event.target.value)}
          rows={5}
          className="font-mono text-xs"
          placeholder={'{\n  "name": "Example"\n}'}
        />
        {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
      </div>
      <Button onClick={handleTest} disabled={isTesting} className="w-full">
        {isTesting ? "Testing..." : "Test request"}
      </Button>
      {testError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{testError}</p>
      )}
      {testResult && (
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Full response</p>
            <span className="text-xs text-muted-foreground">
              {testResult.success ? "Success" : "Failed"}
            </span>
          </div>
          <pre className="max-h-72 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

function PromptTemplateSection({
  config,
  inputPathOptions,
  onConfigChange,
}: {
  readonly config: Record<string, unknown>;
  readonly inputPathOptions: readonly PromptInputPathOption[];
  readonly onConfigChange: (key: string, value: unknown) => void;
}) {
  const userPromptSource = String(config.userPromptSource ?? "typed");
  const currentInputPath = String(config.userPromptInputPath ?? "");
  const options = ensureCurrentPromptPathOption(inputPathOptions, currentInputPath);
  const inputPathSelectValue = resolveSelectValue(currentInputPath, options);
  function handlePromptSourceChange(value: string | null): void {
    const nextSource = value === "input" ? "input" : "typed";
    onConfigChange("userPromptSource", nextSource);
    if (nextSource === "input" && !currentInputPath && options[0]) {
      onConfigChange("userPromptInputPath", options[0].value);
    }
  }
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="prompt-system">System Prompt</Label>
        <Textarea
          id="prompt-system"
          value={String(config.systemPrompt ?? "")}
          onChange={(event) => onConfigChange("systemPrompt", event.target.value)}
          rows={3}
          placeholder="You are a helpful assistant..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="prompt-user-source">User Prompt Source</Label>
        <Select value={userPromptSource} onValueChange={handlePromptSourceChange}>
          <SelectTrigger id="prompt-user-source" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="typed">Typed prompt</SelectItem>
            <SelectItem value="input">Input from connected block</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {userPromptSource === "input" ? (
        <div className="space-y-2">
          <Label htmlFor="prompt-input-path">Input Field Path</Label>
          {options.length > 0 && inputPathSelectValue ? (
            <Select
              value={inputPathSelectValue}
              onValueChange={(value) => value && onConfigChange("userPromptInputPath", value)}
            >
              <SelectTrigger id="prompt-input-path" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Connect an HTTP Request, LLM Call, or another block into this Prompt Template to choose an input field.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The dropdown is built from incoming arrows. For HTTP Request nodes, use paths like <span className="font-mono">body</span>, <span className="font-mono">data</span>, or <span className="font-mono">response.body</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="prompt-user">User Prompt</Label>
          <Textarea
            id="prompt-user"
            value={String(config.userPrompt ?? "")}
            onChange={(event) => onConfigChange("userPrompt", event.target.value)}
            rows={4}
            placeholder="Analyze {{input}}"
          />
        </div>
      )}
    </section>
  );
}

function StructuredOutputsSection({ config, externalFieldNames, onConfigChange }: StructuredOutputsSectionProps) {
  const outputFormat = getStructuredOutputFormat(config.outputFormat);
  const fields = getStructuredOutputFields(config.structuredFields);
  const externalNameSet = new Set(externalFieldNames.map((name) => name.trim().toLowerCase()));
  function getDuplicateReason(index: number): string | null {
    const name = fields[index].name.trim().toLowerCase();
    if (!name) {
      return null;
    }
    const withinBlock = fields.some(
      (field, fieldIndex) => fieldIndex !== index && field.name.trim().toLowerCase() === name,
    );
    if (withinBlock) {
      return "Duplicate field name in this block";
    }
    if (externalNameSet.has(name)) {
      return "Field name already used in another LLM block";
    }
    return null;
  }
  const hasDuplicates = fields.some((_, index) => getDuplicateReason(index) !== null);
  function handleFieldChange(index: number, updates: Partial<StructuredOutputField>): void {
    onConfigChange(
      "structuredFields",
      fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...updates } : field)),
    );
  }
  function handleAddField(): void {
    onConfigChange("structuredFields", [...fields, createStructuredOutputField(fields.length)]);
  }
  function handleRemoveField(index: number): void {
    onConfigChange(
      "structuredFields",
      fields.filter((_, fieldIndex) => fieldIndex !== index),
    );
  }
  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Structured outputs</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose text or JSON, then define the fields the model should return.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="llm-output-format">Output format</Label>
        <Select
          value={outputFormat}
          onValueChange={(value) => onConfigChange("outputFormat", value === "json" ? "json" : "text")}
        >
          <SelectTrigger id="llm-output-format" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {outputFormat === "json" && (
        <div className="space-y-3">
          {hasDuplicates && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
              Structured output field names must be unique across all LLM blocks. Rename the highlighted fields.
            </p>
          )}
          {fields.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No fields yet. Add a field to describe the JSON object you expect from the LLM.
            </p>
          )}
          {fields.map((field, index) => (
            <div key={index} className="space-y-2 rounded-lg border bg-background p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`structured-field-name-${index}`} className="text-xs">
                    Field name
                  </Label>
                  <Input
                    id={`structured-field-name-${index}`}
                    value={field.name}
                    onChange={(event) => handleFieldChange(index, { name: event.target.value })}
                    placeholder="summary"
                    aria-invalid={getDuplicateReason(index) !== null}
                    className={getDuplicateReason(index) ? "border-destructive focus-visible:ring-destructive/30" : undefined}
                  />
                  {getDuplicateReason(index) && (
                    <p className="text-[11px] text-destructive">{getDuplicateReason(index)}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`structured-field-type-${index}`} className="text-xs">
                    Type
                  </Label>
                  <Select
                    value={field.type}
                    onValueChange={(value) => handleFieldChange(index, { type: value ?? "string" })}
                  >
                    <SelectTrigger id={`structured-field-type-${index}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURED_OUTPUT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`structured-field-description-${index}`} className="text-xs">
                  Description
                </Label>
                <Input
                  id={`structured-field-description-${index}`}
                  value={field.description}
                  onChange={(event) => handleFieldChange(index, { description: event.target.value })}
                  placeholder="What should this field contain?"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`structured-field-required-${index}`}
                    checked={field.required}
                    onCheckedChange={(checked) => handleFieldChange(index, { required: checked })}
                  />
                  <Label htmlFor={`structured-field-required-${index}`} className="text-xs font-normal">
                    Required
                  </Label>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveField(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleAddField} className="w-full">
            Add field
          </Button>
        </div>
      )}
    </section>
  );
}

export function PropertyPanel() {
  const workflow = useBuilderStore((state) => state.workflow);
  const plugins = useBuilderStore((state) => state.plugins);
  const selectedNodeId = useBuilderStore((state) => state.selectedNodeId);
  const updateNodeConfig = useBuilderStore((state) => state.updateNodeConfig);
  const updateNodeLabel = useBuilderStore((state) => state.updateNodeLabel);
  const removeNode = useBuilderStore((state) => state.removeNode);
  const selectedNode = workflow?.nodes.find((node) => node.id === selectedNodeId);
  const plugin = plugins.find((p) => p.type === selectedNode?.type);
  if (!selectedNode || !plugin) {
    return (
      <Empty className="h-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">◇</EmptyMedia>
          <EmptyTitle>No block selected</EmptyTitle>
          <EmptyDescription>Click a block on the canvas to configure it.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const nodeId = selectedNode.id;
  const promptInputPathOptions =
    selectedNode.type === "PromptTemplate" && workflow
      ? getPromptInputPathOptions(workflow, selectedNode.id)
      : [];
  const gmailOutputPathOptions =
    isGmailNodeType(selectedNode.type) && workflow
      ? getAncestorOutputPathOptions(workflow, selectedNode.id)
      : [];
  const externalStructuredFieldNames =
    selectedNode.type === "LlmCall" && workflow
      ? collectExternalStructuredFieldNames(workflow, selectedNode.id)
      : [];
  function handleConfigChange(key: string, value: unknown): void {
    updateNodeConfig(nodeId, { [key]: value });
  }
  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 p-4 pb-10">
        <p className="text-xs text-muted-foreground">{plugin.description}</p>
        <div className="space-y-2">
          <Label htmlFor="node-display-name">Display name</Label>
          <Input
            id="node-display-name"
            type="text"
            value={selectedNode.label}
            onChange={(event) => updateNodeLabel(nodeId, event.target.value)}
          />
        </div>
        {plugin.configFields.length === 0 && (
          <p className="text-xs text-muted-foreground">This block has no configurable settings.</p>
        )}
        {selectedNode.type === "HttpRequest" ? (
          <HttpRequestSection
            key={selectedNode.id}
            config={selectedNode.config}
            onConfigChange={handleConfigChange}
          />
        ) : selectedNode.type === "PromptTemplate" ? (
          <PromptTemplateSection
            config={selectedNode.config}
            inputPathOptions={promptInputPathOptions}
            onConfigChange={handleConfigChange}
          />
        ) : isGmailNodeType(selectedNode.type) ? (
          <GmailNodeSection
            config={selectedNode.config}
            outputPathOptions={gmailOutputPathOptions}
            onConfigChange={handleConfigChange}
          />
        ) : (
          plugin.configFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`field-${field.key}`}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </Label>
              {field.type === "select" ? (
                (() => {
                  const selectValue = resolveSelectValue(
                    selectedNode.config[field.key],
                    field.options,
                    field.defaultValue,
                  );
                  return selectValue ? (
                    <Select
                      value={selectValue}
                      onValueChange={(value) => value && handleConfigChange(field.key, value)}
                    >
                      <SelectTrigger id={`field-${field.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null;
                })()
              ) : field.type === "textarea" ? (
                <Textarea
                  id={`field-${field.key}`}
                  value={String(selectedNode.config[field.key] ?? field.defaultValue ?? "")}
                  onChange={(event) => handleConfigChange(field.key, event.target.value)}
                  rows={3}
                  placeholder={field.placeholder}
                />
              ) : field.type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id={`field-${field.key}`}
                    checked={Boolean(selectedNode.config[field.key] ?? field.defaultValue)}
                    onCheckedChange={(checked) => handleConfigChange(field.key, checked)}
                  />
                  <Label htmlFor={`field-${field.key}`} className="font-normal text-muted-foreground">
                    Enabled
                  </Label>
                </div>
              ) : field.type === "json" ? (
                <Textarea
                  id={`field-${field.key}`}
                  value={JSON.stringify(selectedNode.config[field.key] ?? field.defaultValue ?? {}, null, 2)}
                  onChange={(event) => {
                    try {
                      handleConfigChange(field.key, JSON.parse(event.target.value));
                    } catch {
                      /* ignore invalid json while typing */
                    }
                  }}
                  rows={4}
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  id={`field-${field.key}`}
                  type={field.type === "number" ? "number" : "text"}
                  value={String(selectedNode.config[field.key] ?? field.defaultValue ?? "")}
                  onChange={(event) =>
                    handleConfigChange(
                      field.key,
                      field.type === "number" ? Number(event.target.value) : event.target.value,
                    )
                  }
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))
        )}
        {selectedNode.type === "LlmCall" && (
          <StructuredOutputsSection
            config={selectedNode.config}
            externalFieldNames={externalStructuredFieldNames}
            onConfigChange={handleConfigChange}
          />
        )}
        <div className="border-t pt-4">
          <Button variant="destructive" size="sm" onClick={() => removeNode(nodeId)}>
            Remove block
          </Button>
        </div>
      </div>
    </div>
  );
}
