// Registers Telar's operations with the agent runtime.
// agent-manifest.json loads this module through "actions.module". Only the names in
// "actions.agentTools" become model tools, called website_<name>.
//
// Each action wraps a method of the page object, TelarPage (src/ui/page-api.ts), which the
// app creates at startup and exposes as globalThis.telarPage. The app's own buttons go
// through the same StudioController, so the assistant and the person share one set of
// rules. Business rules live there, not here.
//
// Every write is one undo step on the canvas (the Undo button reverts it), so all writes
// are "write", not "irreversible". Methods refuse bad input by returning
// {ok: false, reason, field} without changing anything.

/**
 * The page object, or an error the runtime reports as "unknown" when the studio is not
 * running in this page (for example in another site's hidden bridge frame).
 *
 * :return: The TelarPage instance.
 */
function page() {
  const telar = globalThis.telarPage;
  if (!telar) {
    throw new Error("The Telar studio is not running on this page.");
  }
  return telar;
}

const NAME = {
  type: "string",
  minLength: 1,
  maxLength: 80,
  description: "Agent name: letters, digits and _, starting with a letter or _, such as menu_specialist.",
};
const TEXT = { type: "string", minLength: 1, maxLength: 4000 };
const URL_FIELD = {
  type: "string",
  minLength: 8,
  maxLength: 500,
  description: "An https:// URL.",
};
const CALLER = {
  type: "string",
  minLength: 1,
  maxLength: 80,
  description: "Optional: the name of an existing agent that should call the new piece.",
};

class SiteActions {
  /**
   * Register every site action with the runtime.
   *
   * :param actions: The runtime registry facade with a register(definition) method.
   */
  static registerActions(actions) {
    for (const definition of SiteActions.definitions()) {
      actions.register(definition);
    }
  }

  /**
   * :return: Every action definition, in the order agents should learn them.
   */
  static definitions() {
    return [
      {
        name: "get_studio_state",
        description:
          "Read the network on the canvas: its name, description and sample queries, the entry point, every agent (name, description, instructions, what it calls and who calls it), other sites' networks, tool servers, and the checks (conforming, errors, tips, each issue with the piece it is about). Changes nothing.",
        effect: "read",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => page().getState(),
      },
      {
        name: "build_network",
        description:
          "Replace the whole canvas with a new network in one step. The visitor can revert it with Undo. Use only when the visitor asks for a new network. Agents call other agents by name and other sites or tool servers by URL; every URL in calls must also be listed in peers or toolServers. Returns the new state with its checks, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "entryPoint", "agents"],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 60,
              description: "Network name, URL-safe: letters, digits, _ or -, such as panaderia_sol.",
            },
            description: {
              ...TEXT,
              maxLength: 300,
              description: "One sentence on what visitors can do with it.",
            },
            siteName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "The website's display name.",
            },
            sampleQueries: {
              type: "array",
              maxItems: 6,
              items: { type: "string", minLength: 1, maxLength: 200 },
              description: "Two to four questions a visitor could ask.",
            },
            entryPoint: { ...NAME, description: "Name of the agent that receives requests first." },
            agents: {
              type: "array",
              minItems: 1,
              maxItems: 12,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "description", "instructions"],
                properties: {
                  name: NAME,
                  description: { ...TEXT, maxLength: 300, description: "What it does, for its callers." },
                  instructions: { ...TEXT, description: "Its role, what data it may use, and its limits." },
                  calls: {
                    type: "array",
                    maxItems: 12,
                    items: { type: "string", minLength: 1, maxLength: 500 },
                    description: "Agent names, or URLs from peers or toolServers, this agent may call.",
                  },
                },
              },
            },
            peers: {
              type: "array",
              maxItems: 6,
              items: URL_FIELD,
              description: "Other sites' agent network URLs, ending in the network name.",
            },
            toolServers: {
              type: "array",
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["url"],
                properties: {
                  url: URL_FIELD,
                  tools: {
                    type: "array",
                    maxItems: 20,
                    items: { type: "string", minLength: 1, maxLength: 80 },
                    description: "Allowed tool names; leave out to allow all.",
                  },
                },
              },
            },
          },
        },
        execute: (args) => page().buildNetwork(args),
      },
      {
        name: "add_agent",
        description:
          "Add one agent to the canvas, optionally called by an existing agent. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "instructions"],
          properties: {
            name: NAME,
            description: { ...TEXT, maxLength: 300, description: "What it does, for its callers." },
            instructions: { ...TEXT, description: "Its role, what data it may use, and its limits." },
            calledBy: CALLER,
          },
        },
        execute: (args) => page().addAgent(args),
      },
      {
        name: "update_agent",
        description:
          "Rename an agent or change its description or instructions. Connections follow a rename. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { ...NAME, description: "The agent's current name." },
            newName: { ...NAME, description: "Optional new name." },
            description: { ...TEXT, maxLength: 300, description: "Optional new description." },
            instructions: { ...TEXT, description: "Optional new instructions." },
          },
        },
        execute: (args) => page().updateAgent(args),
      },
      {
        name: "add_peer",
        description:
          "Add another website's published agent network, optionally called by an existing agent. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["url"],
          properties: {
            url: {
              ...URL_FIELD,
              description: "The network URL: the folder with its agent-manifest.json, then the network name.",
            },
            calledBy: CALLER,
          },
        },
        execute: (args) => page().addPeer(args),
      },
      {
        name: "add_tool_server",
        description:
          "Add an MCP tool server, optionally limited to some tools and called by an existing agent. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["url"],
          properties: {
            url: URL_FIELD,
            tools: {
              type: "array",
              maxItems: 20,
              items: { type: "string", minLength: 1, maxLength: 80 },
              description: "Allowed tool names; leave out to allow all.",
            },
            calledBy: CALLER,
          },
        },
        execute: (args) => page().addToolServer(args),
      },
      {
        name: "connect",
        description: "Let an agent call another piece. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to"],
          properties: {
            from: { ...NAME, description: "The calling agent's name." },
            to: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "An agent name or a piece's URL.",
            },
          },
        },
        execute: (args) => page().connect(args),
      },
      {
        name: "disconnect",
        description: "Stop an agent from calling a piece. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to"],
          properties: {
            from: { ...NAME, description: "The calling agent's name." },
            to: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "An agent name or a piece's URL.",
            },
          },
        },
        execute: (args) => page().disconnect(args),
      },
      {
        name: "set_entry_point",
        description:
          "Make an agent the network's entry point (front agent). Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: { name: NAME },
        },
        execute: (args) => page().setEntryPoint(args),
      },
      {
        name: "remove_piece",
        description:
          "Remove an agent, other site or tool server and its connections. The visitor can revert it with Undo. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["target"],
          properties: {
            target: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "An agent name or a piece's URL.",
            },
          },
        },
        execute: (args) => page().removePiece(args),
      },
      {
        name: "update_network",
        description:
          "Change the network's name, description, sample queries or the site's display name. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 60,
              description: "URL-safe network name: letters, digits, _ or -.",
            },
            description: { ...TEXT, maxLength: 300, description: "One sentence on what visitors can do." },
            siteName: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "The website's display name.",
            },
            sampleQueries: {
              type: "array",
              maxItems: 6,
              items: { type: "string", minLength: 1, maxLength: 200 },
              description: "Replaces all sample queries.",
            },
          },
        },
        execute: (args) => page().updateNetwork(args),
      },
      {
        name: "apply_fix",
        description:
          "Apply the one-click fix of a check issue that has one (its fix field in website_get_studio_state is not null), such as adding the standard peer rule to the entry agent. Returns the new state, or ok false with a reason.",
        effect: "write",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: {
            code: {
              type: "string",
              minLength: 1,
              maxLength: 80,
              description: "The issue code, such as agentic.peer-rule.",
            },
            piece: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "Optional: the agent name or URL the issue is about.",
            },
          },
        },
        execute: (args) => page().applyFix(args),
      },
      {
        name: "tidy_layout",
        description: "Arrange the cards on the canvas by delegation level. Changes only positions.",
        effect: "write",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => page().tidyLayout(),
      },
    ];
  }
}

// The runtime calls the module's registerActions export.
export const registerActions = SiteActions.registerActions;
export const definitions = SiteActions.definitions;
