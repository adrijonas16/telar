import { hasPeerRule } from "../../agentic/peer-rule.ts";
import type { Rule } from "../types.ts";

export const agenticRules: Rule[] = [
  {
    code: "agentic.peer-rule",
    summary: "The entry agent knows what to do when another site's agent calls it.",
    specRef: "§3.2",
    check: ({ doc }) => {
      const front = doc.nodes.find((n) => n.id === doc.frontAgentId);
      if (front?.kind !== "agent" || !front.instructions.trim() || hasPeerRule(doc, front)) return [];
      return [
        {
          code: "agentic.peer-rule",
          severity: "warning",
          source: "telar",
          specRef: "§3.2",
          nodeId: front.id,
          message: `Other sites' agents can call '${front.name}' without your site's tools. Without a rule for that case, it may only report a missing integration. Add the standard peer rule to its instructions.`,
          fix: { id: "add-peer-rule", label: "Add the peer rule" },
        },
      ];
    },
  },
];
