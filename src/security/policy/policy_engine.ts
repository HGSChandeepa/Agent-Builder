import type {
  PolicyEngine,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
  PolicyRule,
  PolicyViolation,
} from "@/src/security/policy/types";

const DEFAULT_RULES: readonly PolicyRule[] = [
  { type: "pii", enabled: true, config: {} },
  { type: "payload_size", enabled: true, config: { maxKb: 512 } },
  { type: "domain", enabled: true, config: { allowedDomains: [] as string[] } },
  { type: "mutating_action", enabled: true, config: { requireApprovalInProd: true } },
];

function checkPii(payloadStr: string): PolicyViolation | undefined {
  const piiPattern = /\b[\w.-]+@[\w.-]+\.\w{2,}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  if (piiPattern.test(payloadStr)) {
    return { rule: "pii", message: "PII detected in payload" };
  }
  return undefined;
}

function checkPayloadSize(payloadStr: string, maxKb: number): PolicyViolation | undefined {
  const sizeKb = new Blob([payloadStr]).size / 1024;
  if (sizeKb > maxKb) {
    return { rule: "payload_size", message: `Payload size ${sizeKb.toFixed(1)}KB exceeds limit ${maxKb}KB` };
  }
  return undefined;
}

function checkMutatingAction(input: PolicyEvaluationInput): PolicyViolation | undefined {
  const requireApproval = input.environment === "production";
  if (input.isMutating && requireApproval && !input.isSimulation) {
    return { rule: "mutating_action", message: "Mutating actions require approval in production" };
  }
  return undefined;
}

class DefaultPolicyEngine implements PolicyEngine {
  constructor(private readonly rules: readonly PolicyRule[] = DEFAULT_RULES) {}

  evaluate(input: PolicyEvaluationInput): PolicyEvaluationResult {
    const payloadStr = JSON.stringify(input.payload);
    const violations: PolicyViolation[] = [];
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }
      switch (rule.type) {
        case "pii": {
          const violation = checkPii(payloadStr);
          if (violation) {
            violations.push(violation);
          }
          break;
        }
        case "payload_size": {
          const maxKb = Number(rule.config.maxKb ?? 512);
          const violation = checkPayloadSize(payloadStr, maxKb);
          if (violation) {
            violations.push(violation);
          }
          break;
        }
        case "mutating_action": {
          const violation = checkMutatingAction(input);
          if (violation) {
            violations.push(violation);
          }
          break;
        }
      }
    }
    return { passed: violations.length === 0, violations };
  }
}

export const policyEngine = new DefaultPolicyEngine();
