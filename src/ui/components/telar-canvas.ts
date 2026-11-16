import { css, html, LitElement, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  urlLabel,
  peerNetworkName,
  type NodeId,
  type Position,
  type StudioNode,
} from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { sharedStyles } from "../styles/shared.ts";
import { KIND_ICON, KIND_NAME } from "../icons.ts";

type Interaction =
  | { type: "idle" }
  | { type: "pan"; startX: number; startY: number; tx: number; ty: number }
  | { type: "drag"; id: NodeId; grab: Position; moved: boolean }
  | { type: "connect"; from: NodeId; pointer: Position; target: NodeId | null };

const GRID = 8;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * The graph canvas: an SVG view of the document. Drag nodes to move them, drag from an
 * agent's bottom port onto another node to let it call that node, drag the background to pan,
 * scroll to zoom. All edits go through the StudioController.
 */
@customElement("telar-canvas")
export class TelarCanvas extends LitElement {
  @property({ attribute: false }) controller!: StudioController;

  @state() private tx = 0;
  @state() private ty = 0;
  @state() private k = 1;
  @state() private interaction: Interaction = { type: "idle" };

  @query("svg") private svgEl!: SVGSVGElement;

  private binding?: StudioBinding;
  private lastFit = -1;
  private lastSelected: NodeId | null = null;
  private resizeObserver?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
  }

  override firstUpdated(): void {
    this.resizeObserver = new ResizeObserver(() => this.publishCenter());
    this.resizeObserver.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected override updated(changed: PropertyValues): void {
    if (this.controller.fitRequest !== this.lastFit) {
      this.lastFit = this.controller.fitRequest;
      this.fit();
    }
    const selection = this.controller.state.selection;
    const selectedId = selection?.type === "node" ? selection.id : null;
    if (selectedId !== this.lastSelected) {
      this.lastSelected = selectedId;
      if (selectedId && this.interaction.type === "idle") this.revealNode(selectedId);
    }
    if (changed.has("tx") || changed.has("ty") || changed.has("k")) this.publishCenter();
  }

  /**
   * Pans just enough to bring a node fully into view, e.g. one the assistant or the Pieces
   * panel just added off-screen. Does nothing when the node is already visible.
   */
  private revealNode(id: NodeId): void {
    const node = this.controller.node(id);
    const rect = this.getBoundingClientRect();
    if (!node || rect.width === 0) return;
    const margin = 40;
    const top = 52; // legend
    const bottom = 56; // zoom controls
    const left = node.position.x * this.k + this.tx;
    const right = (node.position.x + NODE_WIDTH) * this.k + this.tx;
    const upper = node.position.y * this.k + this.ty;
    const lower = (node.position.y + NODE_HEIGHT) * this.k + this.ty;
    let dx = 0;
    let dy = 0;
    if (left < margin) dx = margin - left;
    else if (right > rect.width - margin) dx = rect.width - margin - right;
    if (upper < top + margin) dy = top + margin - upper;
    else if (lower > rect.height - bottom - margin) dy = rect.height - bottom - margin - lower;
    if (dx || dy) {
      this.tx += dx;
      this.ty += dy;
    }
  }

  /* ------------------------------------------------------------ view */

  fit(): void {
    const nodes = this.controller.doc.nodes;
    const rect = this.getBoundingClientRect();
    if (!nodes.length || rect.width === 0) return;
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_HEIGHT));
    const pad = 56;
    const top = 52; // keep clear of the legend
    const bottom = 48; // keep clear of the zoom controls
    const height = rect.height - top - bottom;
    const k = Math.min(rect.width / (maxX - minX + pad * 2), height / (maxY - minY + pad * 2), 1.15);
    this.k = Math.max(MIN_ZOOM, k);
    this.tx = rect.width / 2 - ((minX + maxX) / 2) * this.k;
    this.ty = top + height / 2 - ((minY + maxY) / 2) * this.k;
  }

  private zoomBy(factor: number, cx?: number, cy?: number): void {
    const rect = this.getBoundingClientRect();
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.k * factor));
    this.tx = px - ((px - this.tx) * k) / this.k;
    this.ty = py - ((py - this.ty) * k) / this.k;
    this.k = k;
  }

  private publishCenter(): void {
    const rect = this.getBoundingClientRect();
    this.controller.viewportCenter = {
      x: (rect.width / 2 - this.tx) / this.k,
      y: (rect.height / 2 - this.ty) / this.k,
    };
  }

  private toWorld(event: PointerEvent | WheelEvent): Position {
    const rect = this.svgEl.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.tx) / this.k,
      y: (event.clientY - rect.top - this.ty) / this.k,
    };
  }

  private nodeAt(event: PointerEvent): NodeId | null {
    const el = this.shadowRoot?.elementFromPoint(event.clientX, event.clientY);
    const g = el?.closest<SVGGElement>("[data-node-id]");
    return g?.dataset.nodeId ?? null;
  }

  /* ------------------------------------------------------------ pointer input */

  private onBackgroundDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.controller.select(null);
    this.interaction = {
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      tx: this.tx,
      ty: this.ty,
    };
    this.svgEl.setPointerCapture(event.pointerId);
  }

  private onNodeDown(event: PointerEvent, node: StudioNode): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.controller.select({ type: "node", id: node.id });
    const p = this.toWorld(event);
    this.interaction = {
      type: "drag",
      id: node.id,
      grab: { x: p.x - node.position.x, y: p.y - node.position.y },
      moved: false,
    };
    this.svgEl.setPointerCapture(event.pointerId);
  }

  private onPortDown(event: PointerEvent, node: StudioNode): void {
    event.stopPropagation();
    this.controller.select({ type: "node", id: node.id });
    this.interaction = { type: "connect", from: node.id, pointer: this.toWorld(event), target: null };
    this.svgEl.setPointerCapture(event.pointerId);
  }

  private onEdgeDown(event: PointerEvent, from: NodeId, to: NodeId): void {
    event.stopPropagation();
    this.controller.select({ type: "edge", from, to });
  }

  private onPointerMove(event: PointerEvent): void {
    const it = this.interaction;
    if (it.type === "pan") {
      this.tx = it.tx + event.clientX - it.startX;
      this.ty = it.ty + event.clientY - it.startY;
    } else if (it.type === "drag") {
      const p = this.toWorld(event);
      const x = Math.round((p.x - it.grab.x) / GRID) * GRID;
      const y = Math.round((p.y - it.grab.y) / GRID) * GRID;
      const node = this.controller.node(it.id);
      if (node && (node.position.x !== x || node.position.y !== y)) {
        this.controller.moveNode(it.id, { x, y });
        it.moved = true;
      }
    } else if (it.type === "connect") {
      const target = this.nodeAt(event);
      this.interaction = { ...it, pointer: this.toWorld(event), target: target !== it.from ? target : null };
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const it = this.interaction;
    if (it.type === "connect" && it.target) this.controller.connect(it.from, it.target);
    this.interaction = { type: "idle" };
    if (this.svgEl.hasPointerCapture(event.pointerId)) this.svgEl.releasePointerCapture(event.pointerId);
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.svgEl.getBoundingClientRect();
    this.zoomBy(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
  }

  private onNodeKey(event: KeyboardEvent, node: StudioNode): void {
    const step = event.shiftKey ? GRID * 4 : GRID;
    const moves: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = moves[event.key];
    if (!d) return;
    event.preventDefault();
    this.controller.moveNode(node.id, { x: node.position.x + d.x, y: node.position.y + d.y });
  }

  /* ------------------------------------------------------------ rendering */

  private edgePath(a: Position, b: Position): string {
    const x1 = a.x + NODE_WIDTH / 2;
    const y1 = a.y + NODE_HEIGHT;
    const x2 = b.x + NODE_WIDTH / 2;
    const y2 = b.y;
    const dy = Math.max(48, Math.abs(y2 - y1) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2 - 4}`;
  }

  private renderEdges() {
    const { doc, selection } = this.controller.state;
    return doc.edges.map((e) => {
      const a = this.controller.node(e.from);
      const b = this.controller.node(e.to);
      if (!a || !b) return nothing;
      const d = this.edgePath(a.position, b.position);
      const selected = selection?.type === "edge" && selection.from === e.from && selection.to === e.to;
      return svg`<g class="edge ${selected ? "selected" : ""} to-${b.kind}">
        <path class="edge-hit" d=${d} @pointerdown=${(ev: PointerEvent) => this.onEdgeDown(ev, e.from, e.to)}></path>
        <path class="edge-line" d=${d} marker-end="url(#arrow-${selected ? "selected" : b.kind})"></path>
      </g>`;
    });
  }

  private renderConnectPreview() {
    const it = this.interaction;
    if (it.type !== "connect") return nothing;
    const from = this.controller.node(it.from);
    if (!from) return nothing;
    const end = it.target ? this.controller.node(it.target)?.position : undefined;
    const target = end ?? { x: it.pointer.x - NODE_WIDTH / 2, y: it.pointer.y };
    return svg`<path class="edge-line preview" d=${this.edgePath(from.position, target)}></path>`;
  }

  private renderNode(node: StudioNode) {
    const { doc, selection } = this.controller.state;
    const selected = selection?.type === "node" && selection.id === node.id;
    const front = node.id === doc.frontAgentId;
    const issues = this.controller.issuesFor(node.id);
    const errors = issues.filter((i) => i.severity === "error").length;
    const isTarget = this.interaction.type === "connect" && this.interaction.target === node.id;
    const calls = doc.edges.filter((e) => e.from === node.id).length;

    let title: string;
    let subtitle: string;
    if (node.kind === "agent") {
      title = node.name || "(unnamed)";
      subtitle = node.description || "Add a description";
    } else if (node.kind === "peer") {
      title = node.url ? peerNetworkName(node.url) : "Set the network URL";
      subtitle = node.url ? urlLabel(node.url) : "Another site's published agents";
    } else {
      title = node.url ? urlLabel(node.url) : "Set the server URL";
      subtitle = node.toolNames.length
        ? `Tools: ${node.toolNames.join(", ")}`
        : node.url
          ? "All tools allowed"
          : "Tools agents can call";
    }

    const label = `${KIND_NAME[node.kind]}: ${title}${front ? ", entry point" : ""}${
      issues.length ? `, ${issues.length} issue${issues.length > 1 ? "s" : ""}` : ""
    }`;

    return svg`<g
      class="node kind-${node.kind} ${selected ? "selected" : ""} ${isTarget ? "target" : ""}"
      data-node-id=${node.id}
      transform="translate(${node.position.x} ${node.position.y})"
      tabindex="0"
      role="button"
      aria-label=${label}
      aria-pressed=${selected ? "true" : "false"}
      @pointerdown=${(e: PointerEvent) => this.onNodeDown(e, node)}
      @focus=${() => this.controller.select({ type: "node", id: node.id })}
      @keydown=${(e: KeyboardEvent) => this.onNodeKey(e, node)}
    >
      <rect class="halo" x="-5" y="-5" width=${NODE_WIDTH + 10} height=${NODE_HEIGHT + 10} rx="16"></rect>
      <rect class="card" width=${NODE_WIDTH} height=${NODE_HEIGHT} rx="12"></rect>
      <rect class="tile" x="14" y="14" width="30" height="30" rx="8"></rect>
      <g class="icon" transform="translate(20 20) scale(0.75)">${KIND_ICON[node.kind]}</g>
      <text class="kind" x="54" y="25">${KIND_NAME[node.kind]}</text>
      <text class="title" x="54" y="44">${truncate(title, 21)}</text>
      <text class="subtitle" x="14" y="68">${truncate(subtitle, 34)}</text>
      ${
        front
          ? svg`<g class="badge" transform="translate(${NODE_WIDTH - 92} -11)"><rect width="84" height="22" rx="11"></rect><text x="42" y="15">Entry point</text></g>`
          : nothing
      }
      ${node.kind === "agent" && calls && !front ? svg`<text class="calls" x=${NODE_WIDTH - 14} y="25">calls ${calls}</text>` : nothing}
      ${
        issues.length
          ? svg`<g class="issue-dot ${errors ? "error" : "warning"}" transform="translate(${NODE_WIDTH - 2} ${NODE_HEIGHT - 2})">
              <circle r="11"></circle><text y="4">${errors ? "!" : issues.length}</text>
              <title>${issues.length} issue${issues.length > 1 ? "s" : ""}: select the card to see them</title></g>`
          : nothing
      }
      ${
        node.kind === "agent"
          ? svg`<g class="port" transform="translate(${NODE_WIDTH / 2} ${NODE_HEIGHT})"
                @pointerdown=${(e: PointerEvent) => this.onPortDown(e, node)}>
                <circle class="port-hit" r="16"></circle><circle class="port-dot" r="8"></circle>
                <path class="port-plus" d="M -3.5 0 H 3.5 M 0 -3.5 V 3.5"></path>
                <title>Drag from here to another card to let ${title} call it</title></g>`
          : nothing
      }
    </g>`;
  }

  override render() {
    const doc = this.controller.doc;
    const warp = 28 * this.k;
    return html`
      <svg
        class=${this.interaction.type === "pan" ? "panning" : ""}
        @pointerdown=${this.onBackgroundDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @wheel=${this.onWheel}
        aria-label="Agent network graph"
      >
        <defs>
          <pattern
            id="warp"
            width=${warp}
            height=${warp * 6}
            patternUnits="userSpaceOnUse"
            x=${this.tx % warp}
            y=${this.ty % (warp * 6)}
          >
            <line x1="0.5" y1="0" x2="0.5" y2=${warp * 6} class="warp"></line>
            <line x1="0" y1="0.5" x2=${warp} y2="0.5" class="weft"></line>
          </pattern>
          ${(["agent", "peer", "mcp", "selected"] as const).map(
            (k) =>
              svg`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" class="arrow arrow-${k}"></path></marker>`,
          )}
        </defs>
        <rect class="bg" width="100%" height="100%" fill="url(#warp)"></rect>
        <g transform="translate(${this.tx} ${this.ty}) scale(${this.k})">
          ${this.renderEdges()} ${this.renderConnectPreview()} ${doc.nodes.map((n) => this.renderNode(n))}
        </g>
      </svg>
      <aside class="legend" aria-label="Legend">
        ${(["agent", "peer", "mcp"] as const).map(
          (k) =>
            html`<span class="item"
              ><svg viewBox="0 0 24 24" class="li ${k}" aria-hidden="true">${KIND_ICON[k]}</svg
              >${KIND_NAME[k]}</span
            >`,
        )}
        <span class="item hint"
          ><span class="plus" aria-hidden="true">+</span>Drag a card's bottom handle onto another card to
          connect</span
        >
      </aside>
      <div class="zoom" role="toolbar" aria-label="View">
        <button class="ghost" title="Zoom out" aria-label="Zoom out" @click=${() => this.zoomBy(1 / 1.2)}>
          −
        </button>
        <span class="level">${Math.round(this.k * 100)}%</span>
        <button class="ghost" title="Zoom in" aria-label="Zoom in" @click=${() => this.zoomBy(1.2)}>+</button>
        <button class="ghost" title="Fit the whole network in view" @click=${() => this.fit()}>Fit</button>
      </div>
      ${
        doc.nodes.length
          ? null
          : html`<div class="empty">
              <h2>Your loom is empty</h2>
              <p>Add an agent from <strong>Pieces</strong> on the left to start weaving your network.</p>
            </div>`
      }
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        position: relative;
        display: block;
        overflow: hidden;
        background: var(--paper);
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
        user-select: none;
        cursor: grab;
      }
      svg.panning {
        cursor: grabbing;
      }
      .warp {
        stroke: var(--warp);
        stroke-width: 1;
      }
      .weft {
        stroke: var(--warp);
        stroke-width: 1;
        opacity: 0.45;
      }
      .edge-hit {
        fill: none;
        stroke: transparent;
        stroke-width: 18;
        cursor: pointer;
      }
      .edge-line {
        fill: none;
        stroke: var(--agent);
        stroke-width: 2.25;
        stroke-linecap: round;
        opacity: 0.75;
        pointer-events: none;
      }
      .edge.to-peer .edge-line {
        stroke: var(--peer);
        stroke-dasharray: 7 5;
      }
      .edge.to-mcp .edge-line {
        stroke: var(--mcp);
      }
      .edge:hover .edge-line {
        opacity: 1;
      }
      .edge.selected .edge-line {
        stroke: var(--accent);
        stroke-width: 3.5;
        opacity: 1;
      }
      .edge-line.preview {
        stroke: var(--accent);
        stroke-dasharray: 4 5;
        opacity: 1;
      }
      .arrow-agent {
        fill: var(--agent);
      }
      .arrow-peer {
        fill: var(--peer);
      }
      .arrow-mcp {
        fill: var(--mcp);
      }
      .arrow-selected {
        fill: var(--accent);
      }
      .node {
        cursor: pointer;
        outline: none;
      }
      .halo {
        fill: none;
        stroke: none;
      }
      .node.selected .halo,
      .node:focus-visible .halo {
        stroke: var(--accent);
        stroke-width: 2.5;
      }
      .node.target .halo {
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-dasharray: 6 4;
      }
      .card {
        fill: var(--surface);
        stroke: var(--line);
        stroke-width: 1;
        filter: drop-shadow(0 3px 8px rgb(28 32 69 / 9%));
      }
      .node:hover .card {
        stroke: var(--line-strong);
      }
      .kind-peer .card {
        stroke: var(--peer);
        stroke-dasharray: 6 4;
        stroke-opacity: 0.55;
      }
      .kind-agent .tile {
        fill: var(--agent-soft);
      }
      .kind-peer .tile {
        fill: var(--peer-soft);
      }
      .kind-mcp .tile {
        fill: var(--mcp-soft);
      }
      .icon {
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .kind-agent .icon {
        stroke: var(--agent);
      }
      .kind-peer .icon {
        stroke: var(--peer);
      }
      .kind-mcp .icon {
        stroke: var(--mcp);
      }
      text {
        font-family: var(--font-sans);
      }
      .kind {
        font-size: 11.5px;
        font-weight: 700;
      }
      .kind-agent .kind {
        fill: var(--agent);
      }
      .kind-peer .kind {
        fill: var(--peer);
      }
      .kind-mcp .kind {
        fill: var(--mcp);
      }
      .title {
        font-family: var(--font-display);
        font-size: 15.5px;
        font-weight: 650;
        fill: var(--ink);
      }
      .subtitle {
        font-size: 12px;
        fill: var(--ink-3);
      }
      .calls {
        font-size: 11px;
        fill: var(--ink-3);
        text-anchor: end;
      }
      .badge rect {
        fill: var(--accent);
      }
      .badge text {
        fill: var(--accent-ink);
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
      }
      .issue-dot circle {
        stroke: var(--surface);
        stroke-width: 2.5;
      }
      .issue-dot.error circle {
        fill: var(--error);
      }
      .issue-dot.warning circle {
        fill: var(--warning);
      }
      .issue-dot text {
        fill: #fff;
        font-size: 12px;
        font-weight: 700;
        text-anchor: middle;
      }
      .port {
        cursor: crosshair;
      }
      .port-hit {
        fill: transparent;
      }
      .port-dot {
        fill: var(--surface);
        stroke: var(--agent);
        stroke-width: 2;
      }
      .port-plus {
        stroke: var(--agent);
        stroke-width: 1.75;
        stroke-linecap: round;
      }
      .port:hover .port-dot,
      .node.selected .port-dot {
        fill: var(--agent);
      }
      .port:hover .port-plus,
      .node.selected .port-plus {
        stroke: #fff;
      }
      .zoom {
        position: absolute;
        right: 14px;
        bottom: 14px;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: var(--radius);
        background: var(--surface);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
      }
      .zoom button {
        min-width: 30px;
        justify-content: center;
      }
      .level {
        font-size: 12px;
        color: var(--ink-3);
        min-width: 42px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .legend {
        position: absolute;
        left: 14px;
        top: 14px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 16px;
        max-width: calc(100% - 28px);
        padding: 7px 12px;
        border-radius: var(--radius);
        background: rgb(255 255 255 / 88%);
        border: 1px solid var(--line);
        font-size: 12px;
        color: var(--ink-2);
        pointer-events: none;
      }
      .item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .li {
        width: 15px;
        height: 15px;
        fill: none;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .li.agent {
        stroke: var(--agent);
      }
      .li.peer {
        stroke: var(--peer);
      }
      .li.mcp {
        stroke: var(--mcp);
      }
      .hint {
        color: var(--ink-3);
      }
      .plus {
        display: inline-grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1.75px solid var(--agent);
        color: var(--agent);
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }
      .empty {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        text-align: center;
        color: var(--ink-2);
        pointer-events: none;
      }
      .empty h2 {
        margin: 0 0 6px;
        font-size: 26px;
        color: var(--ink);
      }
      .empty p {
        margin: 0;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-canvas": TelarCanvas;
  }
}
