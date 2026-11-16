/**
 * TelarPage: the studio's operations, as the page's own agent calls them.
 *
 * This is the "page object" of the open agentic web's site-actions pattern: one object,
 * created at startup, whose methods the published actions module (`public/site-actions.js`)
 * wraps as `website_*` tools. Every method goes through the same StudioController the UI
 * uses, so the assistant and a person follow one set of rules.
 *
 * Conventions (from the agentify-website skill):
 * - Inputs are plain JSON; results are plain JSON copies, never live objects.
 * - A refused input returns `{ok: false, reason, field}` and changes nothing. Methods throw
 *   only on unexpected failures (the runtime then reports the outcome as unknown).
 * - Every write is one undo step, so the visitor can revert anything with Undo.
 * - Pieces are addressed the way a person reads the canvas: agents by name, other sites
 *   and tool servers by URL.
 */
import {
  AGENT_NAME_PATTERN,
  applyFix,
  withPeerRule,
  applyLayout,
  commands,
  createAgent,
  createMcp,
  createPeer,
  defaultParameters,
  isSecurePeerUrl,
  NETWORK_NAME_PATTERN,
  peerNetworkName,
  type AgentNode,
  type Edge,
  type McpNode,
  type NodeId,
  type PeerNode,
  type StudioDocument,
  type StudioNode,
} from "../core/index.ts";
import type { StudioController } from "./controller.ts";

export type Refusal = { ok: false; reason: string; field?: string };

const MAX_TEXT = 4000;

function refuse(reason: string, field?: string): Refusal {
  return field ? { ok: false, reason, field } : { ok: false, reason };
}

function label(node: StudioNode): string {
  return node.kind === "agent" ? node.name : node.url;
}

export interface AgentSpec {
  name: string;
  description: string;
  instructions: string;
  /** Agent names or URLs this agent may call. */
  calls?: string[];
}

export interface BuildSpec {
  name: string;
  description: string;
  siteName?: string;
  sampleQueries?: string[];
  entryPoint: string;
  agents: AgentSpec[];
  peers?: string[];
  toolServers?: Array<{ url: string; tools?: string[] }>;
}

export class TelarPage {
  constructor(private readonly c: StudioController) {}

  /* ------------------------------------------------------------ read */

  /** Everything on the canvas and the result of the checks, as plain JSON. */
  getState() {
    const doc = this.c.doc;
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    const callsOf = (id: NodeId) =>
      doc.edges.filter((e) => e.from === id).map((e) => label(byId.get(e.to) as StudioNode));
    const calledBy = (id: NodeId) =>
      doc.edges.filter((e) => e.to === id).map((e) => label(byId.get(e.from) as StudioNode));
    const entry = doc.nodes.find((n) => n.id === doc.frontAgentId);
    const report = this.c.report;
    return {
      network: {
        name: doc.network.name,
        description: doc.network.description,
        siteName: doc.site.brand,
        sampleQueries: [...doc.network.sampleQueries],
        defaultModel: doc.site.defaultModel,
        llmRouter: doc.site.routerBaseUrl,
      },
      entryPoint: entry?.kind === "agent" ? entry.name : null,
      agents: doc.nodes
        .filter((n): n is AgentNode => n.kind === "agent")
        .map((a) => ({
          name: a.name,
          description: a.description,
          instructions: a.instructions,
          inputFields: Object.keys((a.parameters?.properties as object | undefined) ?? {}),
          calls: [...callsOf(a.id), ...a.unresolvedRefs],
          calledBy: calledBy(a.id),
        })),
      otherSites: doc.nodes
        .filter((n): n is PeerNode => n.kind === "peer")
        .map((p) => ({ url: p.url, network: peerNetworkName(p.url), calledBy: calledBy(p.id) })),
      toolServers: doc.nodes
        .filter((n): n is McpNode => n.kind === "mcp")
        .map((m) => ({ url: m.url, tools: [...m.toolNames], calledBy: calledBy(m.id) })),
      checks: {
        conforming: report.conforming,
        errors: report.errors,
        tips: report.warnings,
        issues: report.issues.map((i) => ({
          severity: i.severity === "error" ? "error" : "tip",
          piece: i.nodeId ? label(byId.get(i.nodeId) as StudioNode) : null,
          message: i.message,
          code: i.code,
          fix: i.fix?.label ?? null,
        })),
      },
      canUndo: this.c.store.canUndo,
    };
  }

  /* ------------------------------------------------------------ helpers */

  private agentByName(name: string): AgentNode | undefined {
    return this.c.doc.nodes.find((n): n is AgentNode => n.kind === "agent" && n.name === name);
  }

  private find(target: string, doc: StudioDocument = this.c.doc): StudioNode | undefined {
    const t = target.trim();
    return doc.nodes.find((n) => (n.kind === "agent" ? n.name === t : n.url === t));
  }

  private agentNames(): string {
    const names = this.c.doc.nodes.filter((n) => n.kind === "agent").map((n) => label(n));
    return names.length ? names.join(", ") : "none yet";
  }

  private checkAgentName(name: string, field = "name"): Refusal | null {
    if (!AGENT_NAME_PATTERN.test(name)) {
      return refuse(
        `'${name}' is not a valid agent name. Use letters, digits and _, starting with a letter or _, such as menu_specialist.`,
        field,
      );
    }
    return null;
  }

  private checkText(value: unknown, field: string, required: boolean): Refusal | null {
    if (value === undefined && !required) return null;
    if (typeof value !== "string" || (required && !value.trim())) return refuse(`Give a ${field}.`, field);
    if (value.length > MAX_TEXT) return refuse(`The ${field} is longer than ${MAX_TEXT} characters.`, field);
    return null;
  }

  private checkUrl(url: string, field: string): Refusal | null {
    if (!isSecurePeerUrl(url)) {
      return refuse(`'${url}' is not an https:// URL (plain http is only allowed for localhost).`, field);
    }
    return null;
  }

  /** Commits a change as one undo step, selects the piece it is about and returns the state. */
  private apply(doc: StudioDocument, focus?: NodeId) {
    this.c.store.commit(doc);
    if (focus) this.c.select({ type: "node", id: focus });
    return { ok: true as const, ...this.getState() };
  }

  /** Connects `caller` (an agent name) to `to`, or refuses. */
  private link(doc: StudioDocument, caller: string, to: NodeId): StudioDocument | Refusal {
    const from = this.find(caller, doc);
    if (!from || from.kind !== "agent") {
      return refuse(`There is no agent named '${caller}'. Agents: ${this.agentNames()}.`, "calledBy");
    }
    const result = commands.connect(doc, from.id, to);
    return result.ok ? result.doc : refuse(result.reason, "calledBy");
  }

  /* ------------------------------------------------------------ writes */

  addAgent(args: { name: string; description: string; instructions: string; calledBy?: string }) {
    const name = args.name.trim();
    const bad =
      this.checkAgentName(name) ??
      this.checkText(args.description, "description", true) ??
      this.checkText(args.instructions, "instructions", true);
    if (bad) return bad;
    if (this.agentByName(name)) return refuse(`An agent named '${name}' already exists.`, "name");
    const node = createAgent({
      name,
      description: args.description.trim(),
      instructions: args.instructions.trim(),
      position: this.spotNear(args.calledBy),
    });
    let doc = commands.addNode(this.c.doc, node);
    if (args.calledBy) {
      const linked = this.link(doc, args.calledBy, node.id);
      if ("ok" in linked) return linked;
      doc = linked;
    }
    return this.apply(doc, node.id);
  }

  updateAgent(args: { name: string; newName?: string; description?: string; instructions?: string }) {
    const agent = this.agentByName(args.name.trim());
    if (!agent)
      return refuse(`There is no agent named '${args.name}'. Agents: ${this.agentNames()}.`, "name");
    const patch: Partial<AgentNode> = {};
    if (args.newName !== undefined) {
      const newName = args.newName.trim();
      const bad = this.checkAgentName(newName, "newName");
      if (bad) return bad;
      if (newName !== agent.name && this.agentByName(newName)) {
        return refuse(`An agent named '${newName}' already exists.`, "newName");
      }
      patch.name = newName;
    }
    const bad =
      this.checkText(args.description, "description", false) ??
      this.checkText(args.instructions, "instructions", false);
    if (bad) return bad;
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.instructions !== undefined) patch.instructions = args.instructions.trim();
    if (!Object.keys(patch).length)
      return refuse("Give at least one of newName, description or instructions.");
    return this.apply(commands.updateNode<AgentNode>(this.c.doc, agent.id, patch), agent.id);
  }

  addPeer(args: { url: string; calledBy?: string }) {
    const url = args.url.trim();
    const bad = this.checkUrl(url, "url");
    if (bad) return bad;
    if (this.find(url)) return refuse(`${url} is already on the canvas.`, "url");
    const node = createPeer(url, this.spotNear(args.calledBy));
    let doc = commands.addNode(this.c.doc, node);
    if (args.calledBy) {
      const linked = this.link(doc, args.calledBy, node.id);
      if ("ok" in linked) return linked;
      doc = linked;
    }
    return this.apply(doc, node.id);
  }

  addToolServer(args: { url: string; tools?: string[]; calledBy?: string }) {
    const url = args.url.trim();
    const bad = this.checkUrl(url, "url");
    if (bad) return bad;
    if (this.find(url)) return refuse(`${url} is already on the canvas.`, "url");
    const tools = (args.tools ?? []).map((t) => t.trim()).filter(Boolean);
    const node = createMcp(url, tools, this.spotNear(args.calledBy));
    let doc = commands.addNode(this.c.doc, node);
    if (args.calledBy) {
      const linked = this.link(doc, args.calledBy, node.id);
      if ("ok" in linked) return linked;
      doc = linked;
    }
    return this.apply(doc, node.id);
  }

  connect(args: { from: string; to: string }) {
    const to = this.find(args.to);
    if (!to) return refuse(`'${args.to}' is not on the canvas.`, "to");
    const linked = this.link(this.c.doc, args.from, to.id);
    if ("ok" in linked) return { ...linked, field: linked.field === "calledBy" ? "from" : linked.field };
    return this.apply(linked, to.id);
  }

  disconnect(args: { from: string; to: string }) {
    const from = this.find(args.from);
    const to = this.find(args.to);
    if (!from || !to || !commands.hasEdge(this.c.doc, from.id, to.id)) {
      return refuse(`'${args.from}' does not call '${args.to}'.`);
    }
    return this.apply(commands.disconnect(this.c.doc, from.id, to.id));
  }

  setEntryPoint(args: { name: string }) {
    const agent = this.agentByName(args.name.trim());
    if (!agent)
      return refuse(`There is no agent named '${args.name}'. Agents: ${this.agentNames()}.`, "name");
    return this.apply(commands.setFrontAgent(this.c.doc, agent.id), agent.id);
  }

  removePiece(args: { target: string }) {
    const node = this.find(args.target);
    if (!node) return refuse(`'${args.target}' is not on the canvas.`, "target");
    return this.apply(commands.removeNode(this.c.doc, node.id));
  }

  updateNetwork(args: { name?: string; description?: string; siteName?: string; sampleQueries?: string[] }) {
    let doc = this.c.doc;
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!NETWORK_NAME_PATTERN.test(name)) {
        return refuse(
          `'${name}' is not a valid network name. Use letters, digits, _ or -, such as panaderia_sol.`,
          "name",
        );
      }
      doc = commands.updateNetwork(doc, { name });
    }
    const bad =
      this.checkText(args.description, "description", false) ??
      this.checkText(args.siteName, "siteName", false);
    if (bad) return bad;
    if (args.description !== undefined)
      doc = commands.updateNetwork(doc, { description: args.description.trim() });
    if (args.sampleQueries !== undefined) {
      doc = commands.updateNetwork(doc, {
        sampleQueries: args.sampleQueries.map((q) => q.trim()).filter(Boolean),
      });
    }
    if (args.siteName !== undefined) doc = commands.updateSite(doc, { brand: args.siteName.trim() });
    if (doc === this.c.doc)
      return refuse("Give at least one of name, description, siteName or sampleQueries.");
    return this.apply(doc);
  }

  /** Applies the one-click fix of a check issue, by its code and the piece it is about. */
  applyFix(args: { code: string; piece?: string }) {
    const target = args.piece ? this.find(args.piece) : undefined;
    if (args.piece && !target) return refuse(`'${args.piece}' is not on the canvas.`, "piece");
    const issue = this.c.report.issues.find(
      (i) => i.code === args.code && (!target || i.nodeId === target.id),
    );
    if (!issue)
      return refuse(
        `There is no '${args.code}' issue${args.piece ? ` on '${args.piece}'` : ""} now.`,
        "code",
      );
    if (!issue.fix)
      return refuse(`The '${args.code}' issue has no automatic fix. Change the network instead.`, "code");
    return this.apply(applyFix(this.c.doc, issue), issue.nodeId);
  }

  tidyLayout() {
    const result = this.apply(applyLayout(this.c.doc));
    this.c.requestFit();
    return result;
  }

  /**
   * Replaces the canvas with a whole network in one undo step. Checks the entire spec
   * before changing anything.
   */
  buildNetwork(spec: BuildSpec) {
    const name = spec.name.trim();
    if (!NETWORK_NAME_PATTERN.test(name)) {
      return refuse(
        `'${name}' is not a valid network name. Use letters, digits, _ or -, such as panaderia_sol.`,
        "name",
      );
    }
    const textBad = this.checkText(spec.description, "description", true);
    if (textBad) return textBad;
    if (!spec.agents.length) return refuse("Give at least one agent.", "agents");

    const names = new Set<string>();
    for (const [i, a] of spec.agents.entries()) {
      const bad =
        this.checkAgentName(a.name.trim(), `agents[${i}].name`) ??
        this.checkText(a.description, `agents[${i}].description`, true) ??
        this.checkText(a.instructions, `agents[${i}].instructions`, true);
      if (bad) return bad;
      if (names.has(a.name.trim())) return refuse(`Two agents are named '${a.name}'.`, `agents[${i}].name`);
      names.add(a.name.trim());
    }
    if (!names.has(spec.entryPoint.trim())) {
      return refuse(`The entry point '${spec.entryPoint}' is not one of the agents.`, "entryPoint");
    }
    const urls = new Set<string>();
    for (const [i, url] of (spec.peers ?? []).entries()) {
      const bad = this.checkUrl(url.trim(), `peers[${i}]`);
      if (bad) return bad;
      urls.add(url.trim());
    }
    for (const [i, server] of (spec.toolServers ?? []).entries()) {
      const bad = this.checkUrl(server.url.trim(), `toolServers[${i}].url`);
      if (bad) return bad;
      urls.add(server.url.trim());
    }
    for (const [i, a] of spec.agents.entries()) {
      for (const ref of a.calls ?? []) {
        const r = ref.trim();
        if (!names.has(r) && !urls.has(r)) {
          return refuse(
            `Agent '${a.name}' calls '${r}', which is not an agent, a peer or a tool server in this network.`,
            `agents[${i}].calls`,
          );
        }
        if (r === a.name.trim()) return refuse(`Agent '${a.name}' cannot call itself.`, `agents[${i}].calls`);
      }
    }

    const nodes: StudioNode[] = spec.agents.map((a) =>
      createAgent({
        name: a.name.trim(),
        description: a.description.trim(),
        instructions: a.instructions.trim(),
        parameters: defaultParameters(),
      }),
    );
    for (const url of spec.peers ?? []) nodes.push(createPeer(url.trim()));
    for (const s of spec.toolServers ?? []) {
      nodes.push(createMcp(s.url.trim(), (s.tools ?? []).map((t) => t.trim()).filter(Boolean)));
    }
    const idOf = new Map(nodes.map((n) => [label(n), n.id]));
    // The entry agent answers other sites' agents too: give it the standard peer rule.
    const entryNode = nodes.find(
      (n): n is AgentNode => n.kind === "agent" && n.name === spec.entryPoint.trim(),
    );
    const edges: Edge[] = [];
    for (const a of spec.agents) {
      for (const ref of new Set((a.calls ?? []).map((r) => r.trim()))) {
        edges.push({ from: idOf.get(a.name.trim()) as NodeId, to: idOf.get(ref) as NodeId });
      }
    }
    let doc = applyLayout({
      ...this.c.doc,
      network: {
        ...this.c.doc.network,
        name,
        description: spec.description.trim(),
        sampleQueries: (spec.sampleQueries ?? []).map((q) => q.trim()).filter(Boolean),
        extra: {},
        metadataExtra: {},
        descriptionInManifestOnly: false,
      },
      site: { ...this.c.doc.site, brand: spec.siteName?.trim() || this.c.doc.site.brand },
      nodes,
      edges,
      frontAgentId: idOf.get(spec.entryPoint.trim()) ?? null,
    });
    if (entryNode) {
      doc = commands.updateNode<AgentNode>(doc, entryNode.id, { instructions: withPeerRule(doc, entryNode) });
    }
    const result = this.apply(doc);
    this.c.requestFit();
    return result;
  }

  /* ------------------------------------------------------------ layout */

  /** A free spot under the caller (or near the view centre) for a new card. */
  private spotNear(callerName?: string) {
    const caller = callerName ? this.find(callerName) : undefined;
    const base = caller ? { x: caller.position.x, y: caller.position.y + 180 } : this.c.viewportCenter;
    const taken = (x: number, y: number) =>
      this.c.doc.nodes.some((n) => Math.abs(n.position.x - x) < 260 && Math.abs(n.position.y - y) < 108);
    let x = Math.round(base.x);
    const y = Math.round(base.y);
    for (let i = 0; i < 12 && taken(x, y); i += 1) x += i % 2 ? -(i + 1) * 260 : (i + 1) * 260;
    return { x, y };
  }
}
