import type { NetworkJson } from "../serialize/network.ts";
import type { JsonObject, NodeId, StudioDocument } from "../model/types.ts";

export type Severity = "error" | "warning";

export interface Issue {
  /** Stable machine-readable code, e.g. `agent.duplicate-name`. */
  code: string;
  severity: Severity;
  message: string;
  /** Node to highlight / select when the issue is clicked. */
  nodeId?: NodeId;
  /** Section of the MVP specification the rule enforces, e.g. `§2.1`. */
  specRef?: string;
  /** `reference-runtime` issues come from the vendored validator the runtime itself runs. */
  source: "telar" | "reference-runtime";
}

/** Everything a rule may look at. Artifacts are derived once per validation run. */
export interface RuleContext {
  doc: StudioDocument;
  network: NetworkJson;
  manifest: JsonObject;
}

export interface Rule {
  code: string;
  /** One line shown in the rules catalogue. */
  summary: string;
  specRef?: string;
  check(ctx: RuleContext): Issue[];
}

export interface ValidationReport {
  issues: Issue[];
  errors: number;
  warnings: number;
  /** True when no errors: the bundle should pass the challenge's Stage One check. */
  conforming: boolean;
}
