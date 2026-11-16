/**
 * A tiny observable store with undo/redo.
 *
 * State is an immutable `StudioDocument` plus UI selection. Components subscribe and
 * re-render; they never mutate state directly. Rapid edits with the same `mergeKey`
 * (dragging a node, typing in a field) collapse into a single undo step.
 */
import type { NodeId, StudioDocument } from "../model/types.ts";

export type Selection = { type: "node"; id: NodeId } | { type: "edge"; from: NodeId; to: NodeId } | null;

export interface StudioState {
  doc: StudioDocument;
  selection: Selection;
}

type Listener = (state: StudioState) => void;

export interface CommitOptions {
  /** Consecutive commits with the same key within `mergeWindowMs` share one undo step. */
  mergeKey?: string;
}

export class Store {
  private state: StudioState;
  private readonly listeners = new Set<Listener>();
  private past: StudioDocument[] = [];
  private future: StudioDocument[] = [];
  private lastMergeKey: string | undefined;
  private lastCommitAt = 0;

  constructor(
    doc: StudioDocument,
    private readonly historyLimit = 200,
    private readonly mergeWindowMs = 1000,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.state = { doc, selection: null };
  }

  get(): StudioState {
    return this.state;
  }

  get doc(): StudioDocument {
    return this.state.doc;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Applies a new document, recording the previous one for undo. */
  commit(next: StudioDocument, options: CommitOptions = {}): void {
    if (next === this.state.doc) return;
    const t = this.now();
    const merge =
      options.mergeKey !== undefined &&
      options.mergeKey === this.lastMergeKey &&
      t - this.lastCommitAt < this.mergeWindowMs;
    if (!merge) {
      this.past.push(this.state.doc);
      if (this.past.length > this.historyLimit) this.past.shift();
    }
    this.future = [];
    this.lastMergeKey = options.mergeKey;
    this.lastCommitAt = t;
    this.set({ ...this.state, doc: next, selection: this.validSelection(next, this.state.selection) });
  }

  /** Replaces the whole document (e.g. import) and clears history. */
  reset(doc: StudioDocument): void {
    this.past = [];
    this.future = [];
    this.lastMergeKey = undefined;
    this.set({ doc, selection: null });
  }

  select(selection: Selection): void {
    this.lastMergeKey = undefined;
    this.set({ ...this.state, selection });
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.state.doc);
    this.lastMergeKey = undefined;
    this.set({ doc: previous, selection: this.validSelection(previous, this.state.selection) });
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state.doc);
    this.lastMergeKey = undefined;
    this.set({ doc: next, selection: this.validSelection(next, this.state.selection) });
  }

  private validSelection(doc: StudioDocument, selection: Selection): Selection {
    if (!selection) return null;
    if (selection.type === "node") return doc.nodes.some((n) => n.id === selection.id) ? selection : null;
    return doc.edges.some((e) => e.from === selection.from && e.to === selection.to) ? selection : null;
  }

  private set(state: StudioState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
