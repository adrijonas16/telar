import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
  peerNetworkName,
  urlLabel,
  type AgentNode,
  type Issue,
  type JsonObject,
  type McpNode,
  type PeerNode,
  type StudioNode,
} from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { sharedStyles } from "../styles/shared.ts";
import "./telar-schema-editor.ts";
import { KIND_EXPLAINER, KIND_ICON, KIND_NAME } from "../icons.ts";
import type { NodeKind } from "../../core/index.ts";

const value = (e: Event) => (e.target as HTMLInputElement | HTMLTextAreaElement).value;

/** Right-hand panel: edits the selected node, the selected edge, or the network settings. */
@customElement("telar-inspector")
export class TelarInspector extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  private binding?: StudioBinding;

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
  }

  private get c(): StudioController {
    return this.controller;
  }

  /* ------------------------------------------------------------ shared bits */

  private heading(kind: NodeKind) {
    return html`<div class="heading ${kind}">
      <span class="tile" aria-hidden="true"><svg viewBox="0 0 24 24">${KIND_ICON[kind]}</svg></span>
      <span
        ><h2 class="title">${KIND_NAME[kind]}</h2>
        <span class="hint">${KIND_EXPLAINER[kind]}</span></span
      >
    </div>`;
  }

  private renderIssues(issues: Issue[]) {
    if (!issues.length) return html`<p class="ok">✓ No issues</p>`;
    return html`<ul class="issues" aria-label="Issues">
      ${issues.map(
        (i) =>
          html`<li class=${i.severity}>
            <span class="sev">${i.severity === "error" ? "Error" : "Tip"}</span>${i.message}
            ${
              i.fix
                ? html`<button class="small fix" @click=${() => this.c.applyFix(i)}>${i.fix.label}</button>`
                : nothing
            }
          </li>`,
      )}
    </ul>`;
  }

  private callers(node: StudioNode): AgentNode[] {
    return this.c.doc.edges
      .filter((e) => e.to === node.id)
      .map((e) => this.c.node(e.from))
      .filter((n): n is AgentNode => n?.kind === "agent");
  }

  private nodeLabel(n: StudioNode): string {
    if (n.kind === "agent") return n.name || "(unnamed agent)";
    if (n.kind === "peer") return `${n.url ? peerNetworkName(n.url) : "(peer)"} · ${urlLabel(n.url)}`;
    return `MCP · ${urlLabel(n.url)}`;
  }

  /* ------------------------------------------------------------ agent */

  private renderAgent(agent: AgentNode) {
    const isFront = this.c.doc.frontAgentId === agent.id;
    const others = this.c.doc.nodes.filter((n) => n.id !== agent.id);
    const calls = new Set(this.c.doc.edges.filter((e) => e.from === agent.id).map((e) => e.to));
    return html`
      <header>${this.heading("agent")}</header>
      <div class="entry ${isFront ? "is-front" : ""}">
        ${
          isFront
            ? html`<span class="chip front">Entry point</span>
                <span class="hint">Visitors and other sites talk to this agent first.</span>`
            : html`<button class="small" @click=${() => this.c.setFrontAgent(agent.id)}>
                  Make this the entry point
                </button>
                <span class="hint">Only one agent receives requests from outside.</span>`
        }
      </div>
      <label>
        Name
        <input
          class="mono"
          .value=${live(agent.name)}
          @input=${(e: Event) => this.c.renameAgent(agent.id, value(e).trim())}
          spellcheck="false"
        />
        <span class="hint">Other agents call it by this name. Letters, digits and _.</span>
      </label>
      <label>
        Description
        <textarea
          rows="2"
          .value=${live(agent.description)}
          @input=${(e: Event) => this.c.updateNode<AgentNode>(agent.id, { description: value(e) }, `desc:${agent.id}`)}
        ></textarea>
        <span class="hint">What it does, so callers know when to use it.</span>
      </label>
      <label>
        Instructions
        <textarea
          rows="7"
          .value=${live(agent.instructions)}
          @input=${(e: Event) => this.c.updateNode<AgentNode>(agent.id, { instructions: value(e) }, `instr:${agent.id}`)}
        ></textarea>
        <span class="hint">Public by design: never put keys or secrets here.</span>
      </label>
      <telar-schema-editor
        .schema=${agent.parameters}
        .ownerId=${agent.id}
        @schema-change=${(e: CustomEvent<JsonObject | null>) =>
          this.c.updateNode<AgentNode>(agent.id, { parameters: e.detail }, `params:${agent.id}`)}
      ></telar-schema-editor>
      <fieldset>
        <legend>Can call</legend>
        ${
          others.length
            ? others.map(
                (n) =>
                  html`<label class="check">
                    <input
                      type="checkbox"
                      .checked=${live(calls.has(n.id))}
                      @change=${(e: Event) =>
                        (e.target as HTMLInputElement).checked
                          ? this.c.connect(agent.id, n.id)
                          : this.c.disconnect(agent.id, n.id)}
                    />
                    <span class="dot ${n.kind}"></span>${this.nodeLabel(n)}
                  </label>`,
              )
            : html`<p class="hint">Add more agents, peer networks or MCP servers to connect them.</p>`
        }
        ${agent.unresolvedRefs.map((r) => html`<p class="hint unresolved">Unresolved reference: <code>${r}</code></p>`)}
      </fieldset>
      ${this.renderCallers(agent)}
    `;
  }

  private renderCallers(node: StudioNode) {
    const callers = this.callers(node);
    if (!callers.length) return nothing;
    return html`<p class="hint">Called by: ${callers.map((a) => a.name).join(", ")}</p>`;
  }

  /* ------------------------------------------------------------ peer / mcp */

  private renderPeer(peer: PeerNode) {
    return html`
      <header>${this.heading("peer")}</header>
      <p class="hint">
        With the visitor's consent it runs in their browser, on their own key. It can describe what that site
        offers, but cannot use the site's own functions.
      </p>
      <label>
        Network URL
        <input
          class="mono"
          type="url"
          placeholder="https://partner.example/agents/their_network"
          .value=${live(peer.url)}
          @input=${(e: Event) => this.c.updateNode<PeerNode>(peer.id, { url: value(e).trim() }, `url:${peer.id}`)}
          spellcheck="false"
        />
        <span class="hint">The folder holding their agent-manifest.json, then the network name.</span>
      </label>
      ${this.renderCallers(peer)}
    `;
  }

  private renderMcp(mcp: McpNode) {
    return html`
      <header>${this.heading("mcp")}</header>
      <p class="hint">
        A tool server agents can call. The visitor approves each new server before it is contacted.
      </p>
      <label>
        Server URL
        <input
          class="mono"
          type="url"
          placeholder="https://tools.example/mcp"
          .value=${live(mcp.url)}
          @input=${(e: Event) => this.c.updateNode<McpNode>(mcp.id, { url: value(e).trim() }, `url:${mcp.id}`)}
          spellcheck="false"
        />
      </label>
      <label>
        Allowed tools
        <input
          class="mono"
          placeholder="search, get_item (empty = all)"
          .value=${live(mcp.toolNames.join(", "))}
          @change=${(e: Event) =>
            this.c.updateNode<McpNode>(mcp.id, {
              toolNames: value(e)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })}
          spellcheck="false"
        />
        <span class="hint"
          >Comma-separated. Restricting tools reduces what an agent can be tricked into doing.</span
        >
      </label>
      ${this.renderCallers(mcp)}
    `;
  }

  /* ------------------------------------------------------------ network */

  private renderNetwork() {
    const { network, site } = this.c.doc;
    return html`
      <header><h2 class="title">Network and site</h2></header>
      <p class="hint">How your network is named and described when your site publishes it.</p>
      <label>
        Network name
        <input
          class="mono"
          .value=${live(network.name)}
          @input=${(e: Event) => this.c.updateNetwork({ name: value(e).trim() }, "net:name")}
          spellcheck="false"
        />
        <span class="hint">Becomes the last segment of the network's public URL.</span>
      </label>
      <label>
        Description
        <textarea
          rows="3"
          .value=${live(network.description)}
          @input=${(e: Event) => this.c.updateNetwork({ description: value(e) }, "net:desc")}
        ></textarea>
      </label>
      <label>
        Sample queries
        <textarea
          rows="4"
          placeholder="One per line"
          .value=${live(network.sampleQueries.join("\n"))}
          @change=${(e: Event) =>
            this.c.updateNetwork({
              sampleQueries: value(e)
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })}
        ></textarea>
        <span class="hint">One per line. Shown to visitors and other agents.</span>
      </label>
      <label>
        Site name
        <input
          .value=${live(site.brand)}
          @input=${(e: Event) => this.c.updateSite({ brand: value(e) }, "site:brand")}
        />
      </label>
      <label>
        Default LLM router
        <input
          class="mono"
          type="url"
          .value=${live(site.routerBaseUrl)}
          @input=${(e: Event) => this.c.updateSite({ routerBaseUrl: value(e).trim() }, "site:router")}
          spellcheck="false"
        />
        <span class="hint"
          >OpenAI-compatible base URL. Visitors bring their own key; the site never pays for calls.</span
        >
      </label>
      <label>
        Default model
        <input
          class="mono"
          .value=${live(site.defaultModel)}
          @input=${(e: Event) => this.c.updateSite({ defaultModel: value(e).trim() }, "site:model")}
          spellcheck="false"
        />
        <span class="hint">A hint: a caller's own model choice takes precedence.</span>
      </label>
      <p class="hint">Select a node on the canvas to edit it.</p>
    `;
  }

  /* ------------------------------------------------------------ edge */

  private renderEdge(from: StudioNode, to: StudioNode) {
    return html`
      <header><h2 class="title">Connection</h2></header>
      <p><strong>${this.nodeLabel(from)}</strong> can call <strong>${this.nodeLabel(to)}</strong>.</p>
      <button class="danger" @click=${() => this.c.disconnect(from.id, to.id)}>Remove connection</button>
    `;
  }

  override render() {
    const selection = this.c.state.selection;
    const node = this.c.selectedNode;
    let body;
    if (node?.kind === "agent") body = this.renderAgent(node);
    else if (node?.kind === "peer") body = this.renderPeer(node);
    else if (node?.kind === "mcp") body = this.renderMcp(node);
    else if (selection?.type === "edge") {
      const from = this.c.node(selection.from);
      const to = this.c.node(selection.to);
      body = from && to ? this.renderEdge(from, to) : nothing;
    } else body = this.renderNetwork();

    return html`
      <div class="body">${body}</div>
      ${
        node
          ? html`<section class="footer">
              <h3>Checks</h3>
              ${this.renderIssues(this.c.issuesFor(node.id))}
              <button class="danger" @click=${() => this.c.removeSelection()}>
                Delete
                ${node.kind === "agent" ? "agent" : node.kind === "peer" ? "peer network" : "MCP server"}
              </button>
            </section>`
          : nothing
      }
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        overflow: auto;
        background: var(--surface);
      }
      .body {
        display: grid;
        gap: 14px;
        padding: 16px;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      header {
        align-items: flex-start;
      }
      .heading {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .heading .hint {
        display: block;
        margin-top: 2px;
      }
      .title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: var(--ink);
      }
      .tile {
        flex: none;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
      }
      .tile svg {
        width: 21px;
        height: 21px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .heading.agent .tile {
        background: var(--agent-soft);
        color: var(--agent);
      }
      .heading.peer .tile {
        background: var(--peer-soft);
        color: var(--peer);
      }
      .heading.mcp .tile {
        background: var(--mcp-soft);
        color: var(--mcp);
      }
      .kind.agent {
        color: var(--agent);
      }
      .kind.peer {
        color: var(--peer);
      }
      .kind.mcp {
        color: var(--mcp);
      }
      .kind.net {
        color: var(--ink-2);
      }
      .entry {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        border: 1px solid var(--line);
      }
      .entry.is-front {
        background: var(--accent-soft);
        border-color: transparent;
      }
      .chip.front {
        flex: none;
        white-space: nowrap;
        background: var(--accent-soft);
        color: var(--accent);
        border-color: transparent;
      }
      button.small {
        padding: 3px 8px;
        font-size: 12px;
      }
      p {
        margin: 0;
        line-height: 1.45;
      }
      fieldset {
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        padding: 8px 10px 10px;
        margin: 0;
        display: grid;
        gap: 6px;
      }
      legend {
        font-size: 12px;
        font-weight: 600;
        color: var(--ink-2);
        padding: 0 4px;
      }
      label.check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 400;
        color: var(--ink);
        font-size: 13px;
      }
      label.check input {
        width: auto;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        flex: none;
      }
      .dot.agent {
        background: var(--agent);
      }
      .dot.peer {
        background: var(--peer);
      }
      .dot.mcp {
        background: var(--mcp);
      }
      .unresolved code {
        color: var(--error);
      }
      .footer {
        margin-top: auto;
        padding: 14px 16px 16px;
        border-top: 1px solid var(--line);
        display: grid;
        gap: 10px;
      }
      h3 {
        margin: 0;
        font-size: 12px;
        color: var(--ink-2);
      }
      .ok {
        color: var(--ok);
        font-size: 13px;
      }
      .issues {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      .issues li {
        font-size: 12.5px;
        line-height: 1.4;
        padding: 7px 9px;
        border-radius: var(--radius-sm);
      }
      .issues .fix {
        display: flex;
        margin-top: 8px;
        border-color: var(--agent);
        color: var(--agent);
        font-weight: 700;
      }
      .issues li.error {
        background: var(--error-soft);
      }
      .issues li.warning {
        background: var(--warning-soft);
      }
      .sev {
        font-weight: 700;
        margin-right: 6px;
      }
      .error .sev {
        color: var(--error);
      }
      .warning .sev {
        color: var(--warning);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-inspector": TelarInspector;
  }
}
