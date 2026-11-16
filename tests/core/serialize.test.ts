import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  fromNetworkJson,
  ImportError,
  parseNetworkText,
  toNetworkJson,
} from "../../src/core/serialize/network.ts";
import { toManifest } from "../../src/core/serialize/manifest.ts";
import { bakerySample } from "../../src/core/samples/bakery.ts";
import type { JsonObject } from "../../src/core/model/types.ts";

const fixture = (name: string): JsonObject =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")) as JsonObject;

const OFFICIAL = ["pizza", "guesthouse", "harbor"] as const;

describe("network serialization", () => {
  it.each(OFFICIAL)("round-trips the official %s example without losing data", (name) => {
    const network = fixture(`${name}.network.json`);
    const manifest = fixture(`${name}.manifest.json`);
    const entry = (manifest.networks as JsonObject[])[0] as JsonObject;
    const doc = fromNetworkJson(network, {
      name: entry.name as string,
      frontMan: entry.front_man as string,
      description: entry.description as string,
    });
    expect(toNetworkJson(doc)).toEqual(network);
  });

  it("emits the front agent first so the runtime picks the same front_man", () => {
    const doc = bakerySample();
    const agents = doc.nodes.filter((n) => n.kind === "agent");
    const last = agents.at(-1);
    if (!last) throw new Error("sample has agents");
    const json = toNetworkJson({ ...doc, frontAgentId: last.id });
    expect(json.tools[0]?.name).toBe(last.kind === "agent" ? last.name : "");
  });

  it("writes MCP references as descriptors and peers as URLs", () => {
    const json = toNetworkJson(bakerySample());
    const orders = json.tools.find((t) => t.name === "order_specialist");
    expect(orders?.tools).toEqual([
      "https://courier.example/agents/lima_courier",
      { url: "https://tools.example/mcp", tools: ["search_addresses"] },
    ]);
  });

  it("keeps the model hint out of the network when the source had none", () => {
    const doc = fromNetworkJson({
      metadata: { description: "x" },
      tools: [{ name: "a", function: { description: "d" }, instructions: "i", tools: [] }],
    });
    expect(toNetworkJson(doc)).not.toHaveProperty("llm_config");
  });

  it("keeps unresolved references so validation can report them", () => {
    const doc = fromNetworkJson({
      tools: [{ name: "a", function: { description: "d" }, instructions: "i", tools: ["typo_agent"] }],
    });
    expect(toNetworkJson(doc).tools[0]?.tools).toEqual(["typo_agent"]);
  });

  it("rejects non-JSON text with a helpful message", () => {
    expect(() => parseNetworkText("tools = [ ]")).toThrow(ImportError);
    expect(() => parseNetworkText("[]")).toThrow(/JSON object/);
  });

  it("rejects a manifest front_man that is not in the network", () => {
    expect(() =>
      fromNetworkJson({ tools: [{ name: "a", instructions: "i" }] }, { frontMan: "missing" }),
    ).toThrow(/front_man/);
  });
});

describe("manifest", () => {
  it("lists every peer origin in allowed_peers and points at the network file", () => {
    const manifest = toManifest(bakerySample());
    expect(manifest.allowed_peers).toEqual(["https://courier.example"]);
    expect((manifest.networks as JsonObject[])[0]).toMatchObject({
      name: "panaderia_sol",
      front_man: "bakery_assistant",
      hocon: "./panaderia_sol.network.json",
    });
  });
});
