import type { Json } from "../../model/types.ts";
import { findSecret } from "../../util/secrets.ts";
import type { Issue, Rule } from "../types.ts";

/** Walks every string in a JSON value, yielding [path, text]. */
function* strings(value: Json, path: string): Generator<[string, string]> {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) yield* strings(value[i] as Json, `${path}[${i}]`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

export const securityRules: Rule[] = [
  {
    code: "security.secret",
    summary: "No credentials in the published network or manifest.",
    specRef: "§2.2, §4",
    check: ({ doc, network, manifest }) => {
      const issues: Issue[] = [];
      const agentByName = new Map(
        doc.nodes.flatMap((n) => (n.kind === "agent" ? [[n.name, n.id] as const] : [])),
      );
      const scan = (artifact: string, value: Json) => {
        for (const [path, text] of strings(value, "")) {
          const kind = findSecret(text);
          if (!kind) continue;
          const agentMatch = /^tools\[(\d+)\]/.exec(path);
          const agentName = agentMatch ? network.tools[Number(agentMatch[1])]?.name : undefined;
          issues.push({
            code: "security.secret",
            severity: "error",
            source: "telar",
            specRef: "§4",
            nodeId: typeof agentName === "string" ? agentByName.get(agentName) : undefined,
            message: `What looks like a ${kind} is in ${artifact} (${path}). Published files are public: remove it. Visitors enter their own key in the AI model settings.`,
          });
        }
      };
      scan("the network definition", network);
      scan("agent-manifest.json", manifest);
      return issues;
    },
  },
];
