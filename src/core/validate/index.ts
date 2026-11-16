/**
 * Validation entry point. Rules are plain objects registered in `RULES`; adding a check means
 * adding one rule (and its tests) without touching the UI.
 */
import type { StudioDocument } from "../model/types.ts";
import { toManifest } from "../serialize/manifest.ts";
import { toNetworkJson } from "../serialize/network.ts";
import { agentRules } from "./rules/agent-rules.ts";
import { agenticRules } from "./rules/agentic-rules.ts";
import { capabilityRules } from "./rules/capability-rules.ts";
import { graphRules } from "./rules/graph-rules.ts";
import { networkRules } from "./rules/network-rules.ts";
import { referenceRuntimeRule } from "./rules/reference-runtime.ts";
import { securityRules } from "./rules/security-rules.ts";
import type { Issue, Rule, RuleContext, ValidationReport } from "./types.ts";

export type { Issue, Rule, ValidationReport, Severity } from "./types.ts";
export { applyFix } from "./fixes.ts";

export const RULES: readonly Rule[] = [
  referenceRuntimeRule,
  ...networkRules,
  ...agentRules,
  ...graphRules,
  ...capabilityRules,
  ...securityRules,
  ...agenticRules,
];

export function validate(doc: StudioDocument, rules: readonly Rule[] = RULES): ValidationReport {
  const ctx: RuleContext = { doc, network: toNetworkJson(doc), manifest: toManifest(doc) };
  const issues: Issue[] = [];
  for (const rule of rules) {
    try {
      issues.push(...rule.check(ctx));
    } catch (error) {
      // A buggy rule must never hide the others; surface it as an issue instead.
      issues.push({
        code: "telar.rule-crashed",
        severity: "warning",
        source: "telar",
        message: `Check '${rule.code}' failed to run: ${(error as Error).message}`,
      });
    }
  }
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  const errors = issues.filter((i) => i.severity === "error").length;
  return { issues, errors, warnings: issues.length - errors, conforming: errors === 0 };
}
