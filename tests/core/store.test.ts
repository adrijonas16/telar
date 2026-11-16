import { describe, expect, it } from "vitest";
import { Store } from "../../src/core/store/store.ts";
import * as commands from "../../src/core/model/commands.ts";
import { createAgent, createEmptyDocument } from "../../src/core/model/factory.ts";

describe("Store", () => {
  it("undoes and redoes commits", () => {
    const store = new Store(createEmptyDocument());
    const before = store.doc;
    store.commit(commands.addNode(store.doc, createAgent({ name: "b" })));
    expect(store.doc.nodes).toHaveLength(2);
    store.undo();
    expect(store.doc).toBe(before);
    store.redo();
    expect(store.doc.nodes).toHaveLength(2);
  });

  it("merges rapid commits with the same key into one undo step", () => {
    let t = 0;
    const store = new Store(createEmptyDocument(), 200, 1000, () => t);
    const id = store.doc.nodes[0]?.id as string;
    const before = store.doc;
    for (let x = 1; x <= 5; x += 1) {
      t += 100;
      store.commit(commands.moveNode(store.doc, id, { x, y: 0 }), { mergeKey: `move:${id}` });
    }
    store.undo();
    expect(store.doc).toBe(before);
  });

  it("drops a selection whose node was removed", () => {
    const store = new Store(createEmptyDocument());
    const id = store.doc.nodes[0]?.id as string;
    store.select({ type: "node", id });
    store.commit(commands.removeNode(store.doc, id));
    expect(store.get().selection).toBeNull();
  });

  it("notifies subscribers", () => {
    const store = new Store(createEmptyDocument());
    let calls = 0;
    const off = store.subscribe(() => (calls += 1));
    store.select(null);
    off();
    store.select(null);
    expect(calls).toBe(1);
  });
});

describe("commands", () => {
  it("only lets agents call other nodes, once", () => {
    const doc = createEmptyDocument();
    const b = createAgent({ name: "b" });
    const withB = commands.addNode(doc, b);
    const front = doc.nodes[0]?.id as string;
    const first = commands.connect(withB, front, b.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(commands.connect(first.doc, front, b.id).ok).toBe(false);
    expect(commands.connect(first.doc, front, front).ok).toBe(false);
  });

  it("picks a new front agent when the front agent is removed", () => {
    const doc = commands.addNode(createEmptyDocument(), createAgent({ name: "b" }));
    const next = commands.removeNode(doc, doc.frontAgentId as string);
    expect(next.frontAgentId).toBe(next.nodes[0]?.id);
  });

  it("generates unique agent names", () => {
    const doc = createEmptyDocument();
    expect(commands.uniqueAgentName(doc, "front_agent")).toBe("front_agent_2");
    expect(commands.uniqueAgentName(doc, "helper")).toBe("helper");
  });
});
