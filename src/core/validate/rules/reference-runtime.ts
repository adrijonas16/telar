import type { Issue, Rule } from "../types.ts";
import { validate_network } from "../vendor/validation.gen.mjs";

/**
 * Runs the exact validator the reference browser runtime runs before executing a network
 * (vendored, unchanged). If this fails, the network will not load anywhere.
 */
export const referenceRuntimeRule: Rule = {
  code: "runtime.reference",
  summary: "Passes the reference runtime's own validation (vendored from the challenge repo).",
  specRef: "§3.1",
  check: ({ doc, network }) =>
    validate_network(network).map((message): Issue => {
      const agentName = /Agent '([^']*)'/.exec(message)?.[1];
      const node = doc.nodes.find((n) => n.kind === "agent" && n.name === agentName);
      return {
        code: "runtime.reference",
        severity: "error",
        source: "reference-runtime",
        specRef: "§3.1",
        nodeId: node?.id,
        message,
      };
    }),
};
