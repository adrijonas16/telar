import type { Rule } from "../types.ts";

/** Network names become the last path segment of the network's public URL (MVP spec §3.2). */
export const NETWORK_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const networkRules: Rule[] = [
  {
    code: "network.name",
    summary: "The network has a URL-safe name.",
    specRef: "§2.1, §3.2",
    check: ({ doc }) =>
      NETWORK_NAME_PATTERN.test(doc.network.name)
        ? []
        : [
            {
              code: "network.name",
              severity: "error",
              source: "telar",
              specRef: "§3.2",
              message: `Network name '${doc.network.name}' must start with a letter or digit and use only letters, digits, '_' or '-': it becomes the last segment of the network's URL.`,
            },
          ],
  },
  {
    code: "network.description",
    summary: "The network has a short description.",
    specRef: "§2.1",
    check: ({ doc }) =>
      doc.network.description.trim()
        ? []
        : [
            {
              code: "network.description",
              severity: "error",
              source: "telar",
              specRef: "§2.1",
              message:
                "Add a short network description: callers and directories use it to decide when to use this network.",
            },
          ],
  },
  {
    code: "network.front-agent",
    summary: "A front agent (public entry point) is selected.",
    specRef: "§1.2, §2.1",
    check: ({ doc }) => {
      const front = doc.nodes.find((n) => n.id === doc.frontAgentId);
      if (front?.kind === "agent") return [];
      return [
        {
          code: "network.front-agent",
          severity: "error",
          source: "telar",
          specRef: "§2.1",
          message: "Choose a front agent: the network's public entry point.",
        },
      ];
    },
  },
  {
    code: "network.sample-queries",
    summary: "The network lists sample queries.",
    check: ({ doc }) =>
      doc.network.sampleQueries.length
        ? []
        : [
            {
              code: "network.sample-queries",
              severity: "warning",
              source: "telar",
              message: "Add two or three sample queries: they show visitors (and other agents) what to ask.",
            },
          ],
  },
];
