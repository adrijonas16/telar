/**
 * Telar is itself an open agentic website. These tests check its published artifacts
 * with Telar's own validator (dogfooding) and its site actions with the reference
 * runtime's own action registry and argument validator.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { fromNetworkJson, validate, type JsonObject } from "../../src/core/index.ts";
import { StudioController } from "../../src/ui/controller.ts";
import { TelarPage } from "../../src/ui/page-api.ts";
import { bakerySample } from "../../src/core/index.ts";
import { ActionRegistry, validateData } from "../../public/runtime/actions.js";
import { definitions, registerActions } from "../../public/site-actions.js";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8")) as JsonObject;

interface Definition {
  name: string;
  inputSchema: object;
  execute: (args: object) => unknown;
}

const manifest = read("agent-manifest.json");
const entry = (manifest.networks as JsonObject[])[0] as JsonObject;
const agentTools = (manifest.actions as JsonObject).agentTools as string[];

describe("Telar as an open agentic website", () => {
  afterEach(() => {
    delete (globalThis as { telarPage?: unknown }).telarPage;
  });

  it("publishes a network that passes Telar's own checks", () => {
    const doc = fromNetworkJson(read(String(entry.hocon).replace("./", "")), {
      name: String(entry.name),
      frontMan: String(entry.front_man),
      description: String(entry.description),
    });
    const report = validate(doc);
    expect(report.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("registers every agentTools action with the reference runtime's registry", async () => {
    const registry = new ActionRegistry();
    const scope = { base: "https://telar.example/", network: "telar_assistant" };
    await registerActions({ register: (d: Definition) => registry.register(scope, d) });
    const names = (registry.catalog(scope) as Array<{ name: string; availability: string }>).map(
      (a) => a.name,
    );
    expect(names.sort()).toEqual([...agentTools].sort());
    for (const a of registry.catalog(scope) as Array<{ availability: string }>) {
      expect(a.availability).toBe("local-only");
    }
  });

  it("runs actions against the studio, through the runtime's argument validator", () => {
    const controller = new StudioController(bakerySample());
    (globalThis as { telarPage?: TelarPage }).telarPage = new TelarPage(controller);
    const byName = new Map((definitions() as Definition[]).map((d) => [d.name, d]));
    const call = (name: string, args: object) => {
      const d = byName.get(name) as Definition;
      validateData(d.inputSchema, args);
      return d.execute(args) as { ok?: boolean };
    };

    expect(call("get_studio_state", {})).toMatchObject({ entryPoint: "bakery_assistant" });
    expect(
      call("add_agent", {
        name: "reviews_agent",
        description: "Summarizes reviews.",
        instructions: "Use only reviews the site provides.",
        calledBy: "bakery_assistant",
      }).ok,
    ).toBe(true);
    expect(call("connect", { from: "reviews_agent", to: "menu_specialist" }).ok).toBe(true);
    expect(call("add_agent", { name: "bad name", description: "d", instructions: "i" }).ok).toBe(false);
    // Arguments the schema forbids never reach the studio.
    expect(() => validateData(byName.get("add_agent")?.inputSchema, { name: "x", extra: 1 })).toThrow();
  });

  it("reports a missing studio as an error the runtime treats as unknown", () => {
    const action = (definitions() as Definition[]).find((d) => d.name === "get_studio_state") as Definition;
    expect(() => action.execute({})).toThrow(/not running/);
  });
});
