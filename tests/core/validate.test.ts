import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validate } from "../../src/core/validate/index.ts";
import { bakerySample } from "../../src/core/samples/bakery.ts";
import { fromNetworkJson } from "../../src/core/serialize/network.ts";
import * as commands from "../../src/core/model/commands.ts";
import { createAgent, createEmptyDocument, createPeer } from "../../src/core/model/factory.ts";
import type { AgentNode, JsonObject, StudioDocument } from "../../src/core/model/types.ts";

const codes = (doc: StudioDocument, severity?: "error" | "warning") =>
  validate(doc)
    .issues.filter((i) => !severity || i.severity === severity)
    .map((i) => i.code);

const firstAgent = (doc: StudioDocument) => doc.nodes.find((n) => n.kind === "agent") as AgentNode;

describe("validate", () => {
  it("accepts the bakery sample", () => {
    const report = validate(bakerySample());
    expect(report.errors).toBe(0);
    expect(report.conforming).toBe(true);
  });

  it.each(["pizza", "guesthouse", "harbor"])("finds no errors in the official %s example", (name) => {
    const read = (f: string) =>
      JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8")) as JsonObject;
    const entry = (read(`${name}.manifest.json`).networks as JsonObject[])[0] as JsonObject;
    const doc = fromNetworkJson(read(`${name}.network.json`), {
      name: entry.name as string,
      frontMan: entry.front_man as string,
      description: entry.description as string,
    });
    expect(validate(doc).issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("reports duplicate agent names", () => {
    const doc = commands.addNode(
      createEmptyDocument(),
      createAgent({ name: "front_agent", description: "x", instructions: "y" }),
    );
    expect(codes(doc, "error")).toContain("agent.duplicate-name");
  });

  it("reports missing descriptions and instructions", () => {
    const doc = createEmptyDocument();
    const next = commands.updateNode<AgentNode>(doc, firstAgent(doc).id, {
      description: "",
      instructions: " ",
    });
    expect(codes(next, "error")).toEqual(expect.arrayContaining(["agent.description", "agent.instructions"]));
  });

  it("surfaces the reference runtime's own errors", () => {
    const doc = fromNetworkJson({
      tools: [{ name: "a", function: { description: "d" }, instructions: "i", tools: ["nope"] }],
    });
    const report = validate(doc);
    expect(
      report.issues.some((i) => i.source === "reference-runtime" && /missing tool 'nope'/.test(i.message)),
    ).toBe(true);
  });

  it("requires HTTPS peers that end in a network name", () => {
    let doc = createEmptyDocument();
    const insecure = createPeer("http://partner.example/agents/tours");
    const bare = createPeer("https://partner.example/");
    doc = commands.addNode(commands.addNode(doc, insecure), bare);
    const messages = validate(doc)
      .issues.filter((i) => i.code === "peer.url")
      .map((i) => i.message);
    expect(messages.some((m) => /HTTPS/.test(m))).toBe(true);
    expect(messages.some((m) => /end with the network's name/.test(m))).toBe(true);
  });

  it("allows plain HTTP peers on localhost", () => {
    let doc = createEmptyDocument();
    const local = createPeer("http://localhost:8081/harbor_tours");
    doc = commands.addNode(doc, local);
    doc = (commands.connect(doc, firstAgent(doc).id, local.id) as { ok: true; doc: StudioDocument }).doc;
    expect(codes(doc, "error")).not.toContain("peer.url");
  });

  it("flags credentials pasted into instructions", () => {
    const doc = createEmptyDocument();
    const next = commands.updateNode<AgentNode>(doc, firstAgent(doc).id, {
      instructions: "Use key sk-abcdefghijklmnopqrstuvwxyz123456 for calls.",
    });
    const issue = validate(next).issues.find((i) => i.code === "security.secret");
    expect(issue?.severity).toBe("error");
    expect(issue?.nodeId).toBe(firstAgent(doc).id);
  });

  it("validates input schemas", () => {
    const doc = createEmptyDocument();
    const next = commands.updateNode<AgentNode>(doc, firstAgent(doc).id, {
      parameters: { type: "string", required: ["x"] },
    });
    const issue = validate(next).issues.find((i) => i.code === "agent.parameters");
    expect(issue?.severity).toBe("error");
  });

  it("warns about unreachable nodes and delegation cycles", () => {
    let doc = createEmptyDocument();
    const front = firstAgent(doc);
    const a = createAgent({ name: "a", description: "d", instructions: "i" });
    const orphan = createAgent({ name: "orphan", description: "d", instructions: "i" });
    doc = commands.addNode(commands.addNode(doc, a), orphan);
    for (const [from, to] of [
      [front.id, a.id],
      [a.id, front.id],
    ] as const) {
      const r = commands.connect(doc, from, to);
      if (r.ok) doc = r.doc;
    }
    expect(codes(doc, "warning")).toEqual(expect.arrayContaining(["graph.unreachable", "graph.cycle"]));
  });
});
