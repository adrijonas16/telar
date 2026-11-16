/**
 * StudioController: the single application service the UI talks to.
 *
 * It owns the Store, derives the validation report once per change (not once per
 * component), and exposes intent-level actions ("add an agent here", "connect these").
 * Components never import core commands directly; this keeps the UI thin and gives the
 * studio's future assistant agent the same action surface as a human user.
 */
import {
  applyFix,
  applyLayout,
  bakerySample,
  commands,
  createAgent,
  createEmptyDocument,
  createMcp,
  createPeer,
  Store,
  validate,
  type AgentNode,
  type Issue,
  type NodeId,
  type Position,
  type Selection,
  type StudioDocument,
  type StudioNode,
  type StudioState,
  type ValidationReport,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "../core/index.ts";
import type { Patch } from "../core/model/commands.ts";
import { loadDraft, saveDraft } from "../persistence/draft-storage.ts";

export type ToastKind = "info" | "error";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

type Listener = () => void;

export class StudioController {
  readonly store: Store;
  report: ValidationReport;
  toasts: Toast[] = [];
  /** World coordinates of the canvas viewport centre, kept current by the canvas. */
  viewportCenter: Position = { x: 0, y: 0 };
  /** Incremented to ask the canvas to fit the graph into view (e.g. after import). */
  fitRequest = 0;

  private readonly listeners = new Set<Listener>();
  private toastSeq = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(initial?: StudioDocument) {
    this.store = new Store(initial ?? loadDraft() ?? bakerySample());
    this.report = validate(this.store.doc);
    let lastDoc = this.store.doc;
    this.store.subscribe((state) => {
      if (state.doc !== lastDoc) {
        lastDoc = state.doc;
        this.report = validate(state.doc);
        this.scheduleSave();
      }
      this.emit();
    });
  }

  /* ------------------------------------------------------------ observing */

  get state(): StudioState {
    return this.store.get();
  }

  get doc(): StudioDocument {
    return this.store.doc;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  node(id: NodeId | null | undefined): StudioNode | undefined {
    return commands.findNode(this.doc, id);
  }

  get selectedNode(): StudioNode | undefined {
    const s = this.state.selection;
    return s?.type === "node" ? this.node(s.id) : undefined;
  }

  issuesFor(id: NodeId) {
    return this.report.issues.filter((i) => i.nodeId === id);
  }

  /* ------------------------------------------------------------ selection */

  select(selection: Selection): void {
    this.store.select(selection);
  }

  /* ------------------------------------------------------------ editing */

  /** Adds a node near the viewport centre; if an agent is selected, it now calls the new node. */
  addNode(kind: StudioNode["kind"]): void {
    const parent = this.selectedNode?.kind === "agent" ? this.selectedNode : undefined;
    const at = parent
      ? this.freeSpotNear({ x: parent.position.x + NODE_WIDTH / 2, y: parent.position.y + NODE_HEIGHT * 2.8 })
      : this.freeSpotNear(this.viewportCenter);
    let node: StudioNode;
    if (kind === "agent") {
      node = createAgent({ name: commands.uniqueAgentName(this.doc, "specialist"), position: at });
    } else if (kind === "peer") {
      node = createPeer("", at);
    } else {
      node = createMcp("", [], at);
    }
    let doc = commands.addNode(this.doc, node);
    if (parent) {
      const result = commands.connect(doc, parent.id, node.id);
      if (result.ok) doc = result.doc;
    }
    this.store.commit(doc);
    this.select({ type: "node", id: node.id });
  }

  updateNode<T extends StudioNode>(id: NodeId, patch: Patch<T>, mergeKey?: string): void {
    this.store.commit(commands.updateNode<T>(this.doc, id, patch), { mergeKey });
  }

  /** Renames an agent; other agents reference it by id internally, so edges survive. */
  renameAgent(id: NodeId, name: string): void {
    this.updateNode<AgentNode>(id, { name }, `name:${id}`);
  }

  moveNode(id: NodeId, position: Position): void {
    this.store.commit(commands.moveNode(this.doc, id, position), { mergeKey: `move:${id}` });
  }

  removeSelection(): void {
    const s = this.state.selection;
    if (!s) return;
    if (s.type === "node") this.store.commit(commands.removeNode(this.doc, s.id));
    else this.store.commit(commands.disconnect(this.doc, s.from, s.to));
  }

  connect(from: NodeId, to: NodeId): void {
    const result = commands.connect(this.doc, from, to);
    if (result.ok) this.store.commit(result.doc);
    else this.toast(result.reason, "error");
  }

  disconnect(from: NodeId, to: NodeId): void {
    this.store.commit(commands.disconnect(this.doc, from, to));
  }

  setFrontAgent(id: NodeId): void {
    this.store.commit(commands.setFrontAgent(this.doc, id));
  }

  updateNetwork(patch: Partial<StudioDocument["network"]>, mergeKey?: string): void {
    this.store.commit(commands.updateNetwork(this.doc, patch), { mergeKey });
  }

  updateSite(patch: Partial<StudioDocument["site"]>, mergeKey?: string): void {
    this.store.commit(commands.updateSite(this.doc, patch), { mergeKey });
  }

  /** Applies an issue's one-click fix as a single undo step. */
  applyFix(issue: Issue): void {
    const next = applyFix(this.doc, issue);
    if (next === this.doc) return;
    this.store.commit(next);
    if (issue.nodeId) this.select({ type: "node", id: issue.nodeId });
    this.toast(`Fixed: ${issue.fix?.label ?? issue.code}.`);
  }

  autoLayout(): void {
    this.store.commit(applyLayout(this.doc));
    this.requestFit();
  }

  undo(): void {
    this.store.undo();
  }

  redo(): void {
    this.store.redo();
  }

  /* ------------------------------------------------------------ documents */

  /** Loads a document as a new edit session (history is cleared). */
  open(doc: StudioDocument, message?: string): void {
    this.store.reset(doc);
    this.report = validate(doc);
    this.scheduleSave();
    this.requestFit();
    if (message) this.toast(message);
    this.emit();
  }

  newDocument(): void {
    this.open(createEmptyDocument(), "Started a new network.");
  }

  loadSample(): void {
    this.open(bakerySample(), "Loaded the Panadería Sol sample.");
  }

  requestFit(): void {
    this.fitRequest += 1;
    this.emit();
  }

  /* ------------------------------------------------------------ feedback */

  toast(message: string, kind: ToastKind = "info"): void {
    const toast = { id: (this.toastSeq += 1), kind, message };
    this.toasts = [...this.toasts, toast];
    this.emit();
    setTimeout(
      () => {
        this.toasts = this.toasts.filter((t) => t !== toast);
        this.emit();
      },
      kind === "error" ? 6000 : 3500,
    );
  }

  /* ------------------------------------------------------------ internals */

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveDraft(this.doc), 400);
  }

  /** Finds the nearest free slot (no overlap with existing cards) scanning right, then down. */
  private freeSpotNear(p: Position, doc: StudioDocument = this.doc): Position {
    const w = NODE_WIDTH + 24;
    const h = NODE_HEIGHT + 24;
    const overlaps = (q: Position) =>
      doc.nodes.some((n) => Math.abs(n.position.x - q.x) < w && Math.abs(n.position.y - q.y) < h);
    const start = { x: Math.round(p.x - NODE_WIDTH / 2), y: Math.round(p.y - NODE_HEIGHT / 2) };
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        for (const sign of col === 0 ? [1] : [1, -1]) {
          const q = { x: start.x + sign * col * w, y: start.y + row * h };
          if (!overlaps(q)) return q;
        }
      }
    }
    return start;
  }
}
