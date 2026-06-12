export type PolicyRuleType = "pii" | "domain" | "payload_size" | "mutating_action";

export interface PolicyRule {
  readonly type: PolicyRuleType;
  readonly enabled: boolean;
  readonly config: Record<string, unknown>;
}

export interface PolicyEvaluationInput {
  readonly payload: Record<string, unknown>;
  readonly environment: string;
  readonly isMutating: boolean;
  readonly isSimulation: boolean;
}

export interface PolicyViolation {
  readonly rule: PolicyRuleType;
  readonly message: string;
}

export interface PolicyEvaluationResult {
  readonly passed: boolean;
  readonly violations: readonly PolicyViolation[];
}

export interface PolicyEngine {
  evaluate: (input: PolicyEvaluationInput) => PolicyEvaluationResult;
}
