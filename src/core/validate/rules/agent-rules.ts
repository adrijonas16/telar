import type { AgentNode, Json, JsonObject } from "../../model/types.ts";
import { isCodedAgent } from "../../serialize/network.ts";
import type { Issue, Rule } from "../types.ts";

export const AGENT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function agentsOf(nodes: { kind: string }[]): AgentNode[] {
  return nodes.filter((n): n is AgentNode => n.kind === "agent");
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Problems with a JSON Schema used as an invocation input (MVP spec §2.1). */
export function schemaProblems(schema: JsonObject): string[] {
  const problems: string[] = [];
  if (schema.type !== "object") problems.push("its top-level 'type' must be \"object\"");
  const properties = schema.properties;
  if (properties !== undefined && !isObject(properties)) problems.push("'properties' must be an object");
  const required = schema.required;
  if (required !== undefined) {
    if (!Array.isArray(required) || required.some((r) => typeof r !== "string")) {
      problems.push("'required' must be a list of property names");
    } else if (isObject(properties)) {
      for (const r of required as string[]) {
        if (!(r in properties)) problems.push(`required property '${r}' is not defined in 'properties'`);
      }
    }
  }
  return problems;
}

export const agentRules: Rule[] = [
  {
    code: "agent.name",
    summary: "Every agent has a valid name.",
    specRef: "§2.1",
    check: ({ doc }) =>
      agentsOf(doc.nodes)
        .filter((a) => !AGENT_NAME_PATTERN.test(a.name))
        .map((a) => ({
          code: "agent.name",
          severity: "error",
          source: "telar",
          specRef: "§2.1",
          nodeId: a.id,
          message: a.name
            ? `Agent name '${a.name}' must start with a letter or '_' and use only letters, digits and '_'.`
            : "An agent has no name.",
        })),
  },
  {
    code: "agent.duplicate-name",
    summary: "Agent names are unique within the network.",
    specRef: "§2.1, §3.1",
    check: ({ doc }) => {
      const seen = new Map<string, AgentNode>();
      const issues: Issue[] = [];
      for (const a of agentsOf(doc.nodes)) {
        const first = seen.get(a.name);
        if (first && a.name) {
          issues.push({
            code: "agent.duplicate-name",
            severity: "error",
            source: "telar",
            specRef: "§3.1",
            nodeId: a.id,
            message: `Two agents are named '${a.name}'. Names must be unique: other agents call them by name.`,
          });
        } else seen.set(a.name, a);
      }
      return issues;
    },
  },
  {
    code: "agent.description",
    summary: "Every agent has a function description.",
    specRef: "§2.1",
    check: ({ doc }) =>
      agentsOf(doc.nodes)
        .filter((a) => !a.description.trim())
        .map((a) => ({
          code: "agent.description",
          severity: "error",
          source: "telar",
          specRef: "§2.1",
          nodeId: a.id,
          message: `Agent '${a.name}' needs a description so its callers know when to use it.`,
        })),
  },
  {
    code: "agent.instructions",
    summary: "Every LLM agent has instructions.",
    specRef: "§2.1",
    check: ({ doc }) =>
      agentsOf(doc.nodes)
        .filter((a) => !isCodedAgent(a) && !a.instructions.trim())
        .map((a) => ({
          code: "agent.instructions",
          severity: "error",
          source: "telar",
          specRef: "§2.1",
          nodeId: a.id,
          message: `Agent '${a.name}' needs instructions: its role, what data it may use and its limits.`,
        })),
  },
  {
    code: "agent.parameters",
    summary: "Callable agents declare a JSON Schema for their input.",
    specRef: "§2.1",
    check: ({ doc }) => {
      const issues: Issue[] = [];
      for (const a of agentsOf(doc.nodes)) {
        if (!a.parameters) {
          issues.push({
            code: "agent.parameters",
            severity: "warning",
            source: "telar",
            specRef: "§2.1",
            nodeId: a.id,
            message: `Agent '${a.name}' declares no input schema. Callable agents should expose JSON Schema inputs.`,
          });
          continue;
        }
        const problems = schemaProblems(a.parameters);
        if (problems.length) {
          issues.push({
            code: "agent.parameters",
            severity: "error",
            source: "telar",
            specRef: "§2.1",
            nodeId: a.id,
            message: `Agent '${a.name}' input schema: ${problems.join("; ")}.`,
          });
        }
      }
      return issues;
    },
  },
  {
    code: "agent.unresolved-ref",
    summary: "Every tool reference resolves to an agent, a peer network or an MCP server.",
    specRef: "§3.1",
    check: ({ doc }) =>
      agentsOf(doc.nodes).flatMap((a) =>
        a.unresolvedRefs.map((ref) => ({
          code: "agent.unresolved-ref",
          severity: "error" as const,
          source: "telar" as const,
          specRef: "§3.1",
          nodeId: a.id,
          message: `Agent '${a.name}' calls '${ref}', which is not an agent of this network, a peer URL or an MCP server.`,
        })),
      ),
  },
];
