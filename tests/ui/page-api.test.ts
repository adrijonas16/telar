import { describe, expect, it } from "vitest";
import { StudioController } from "../../src/ui/controller.ts";
import { TelarPage } from "../../src/ui/page-api.ts";
import { bakerySample, toNetworkJson } from "../../src/core/index.ts";

function setup() {
  const controller = new StudioController(bakerySample());
  return { controller, page: new TelarPage(controller) };
}

describe("TelarPage (site actions)", () => {
  it("reads the canvas and the checks as plain JSON", () => {
    const { page } = setup();
    const state = page.getState();
    expect(state.entryPoint).toBe("bakery_assistant");
    expect(state.agents.find((a) => a.name === "order_specialist")?.calls).toEqual([
      "https://courier.example/agents/lima_courier",
      "https://tools.example/mcp",
    ]);
    expect(state.checks.conforming).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("adds an agent called by another, as one undo step", () => {
    const { page, controller } = setup();
    const result = page.addAgent({
      name: "allergy_expert",
      description: "Answers allergen questions.",
      instructions: "Answer only from the menu.",
      calledBy: "menu_specialist",
    });
    expect(result.ok).toBe(true);
    const menu = page.getState().agents.find((a) => a.name === "menu_specialist");
    expect(menu?.calls).toContain("allergy_expert");
    controller.undo();
    expect(page.getState().agents.some((a) => a.name === "allergy_expert")).toBe(false);
  });

  it("refuses bad input without changing anything", () => {
    const { page, controller } = setup();
    const before = controller.doc;
    expect(page.addAgent({ name: "bad name", description: "d", instructions: "i" })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(page.addAgent({ name: "menu_specialist", description: "d", instructions: "i" }).ok).toBe(false);
    expect(page.addAgent({ name: "x", description: "d", instructions: "i", calledBy: "nobody" }).ok).toBe(
      false,
    );
    expect(page.addPeer({ url: "http://insecure.example/net" }).ok).toBe(false);
    expect(page.connect({ from: "https://tools.example/mcp", to: "menu_specialist" }).ok).toBe(false);
    expect(page.setEntryPoint({ name: "ghost" }).ok).toBe(false);
    expect(page.updateNetwork({ name: "has spaces" }).ok).toBe(false);
    expect(controller.doc).toBe(before);
  });

  it("renames an agent without breaking its connections", () => {
    const { page } = setup();
    expect(page.updateAgent({ name: "menu_specialist", newName: "menu_guide" }).ok).toBe(true);
    const front = page.getState().agents.find((a) => a.name === "bakery_assistant");
    expect(front?.calls).toContain("menu_guide");
  });

  it("connects, disconnects and removes pieces by name or URL", () => {
    const { page } = setup();
    expect(page.connect({ from: "menu_specialist", to: "https://tools.example/mcp" }).ok).toBe(true);
    expect(page.disconnect({ from: "menu_specialist", to: "https://tools.example/mcp" }).ok).toBe(true);
    expect(page.removePiece({ target: "https://courier.example/agents/lima_courier" }).ok).toBe(true);
    expect(page.getState().otherSites).toEqual([]);
  });

  it("builds a whole, conforming network from one spec, undoably", () => {
    const { page, controller } = setup();
    const result = page.buildNetwork({
      name: "clinica_dental",
      description: "Answers patients' questions and books appointments.",
      siteName: "Clínica Sonrisa",
      sampleQueries: ["Do you open on Saturdays?", "Book a cleaning for next week."],
      entryPoint: "front_desk",
      agents: [
        {
          name: "front_desk",
          description: "Greets patients and routes their requests.",
          instructions: "Route questions to faq_agent and bookings to booking_agent.",
          calls: ["faq_agent", "booking_agent"],
        },
        {
          name: "faq_agent",
          description: "Answers clinic FAQs.",
          instructions: "Answer from the clinic data only.",
        },
        {
          name: "booking_agent",
          description: "Prepares appointment requests.",
          instructions: "Collect the details; never confirm a booking yourself.",
          calls: ["https://calendar.example/mcp"],
        },
      ],
      toolServers: [{ url: "https://calendar.example/mcp", tools: ["find_slots"] }],
    });
    expect(result.ok).toBe(true);
    const state = page.getState();
    expect(state.network.name).toBe("clinica_dental");
    expect(state.entryPoint).toBe("front_desk");
    expect(state.checks.errors).toBe(0);
    expect(toNetworkJson(controller.doc).tools[0]?.name).toBe("front_desk");
    // The entry agent gets the standard peer rule automatically.
    expect(state.agents.find((a) => a.name === "front_desk")?.instructions).toContain(
      "another site's assistant is asking",
    );
    expect(state.checks.issues.some((i) => i.code === "agentic.peer-rule")).toBe(false);
    controller.undo();
    expect(page.getState().network.name).toBe("panaderia_sol");
  });

  it("applies a check's one-click fix by code, as one undo step", () => {
    const { page, controller } = setup();
    page.setEntryPoint({ name: "menu_specialist" });
    const before = page.getState().checks.issues.find((i) => i.code === "agentic.peer-rule");
    expect(before?.fix).toBe("Add the peer rule");
    expect(page.applyFix({ code: "agentic.peer-rule", piece: "menu_specialist" }).ok).toBe(true);
    expect(page.getState().checks.issues.some((i) => i.code === "agentic.peer-rule")).toBe(false);
    expect(page.applyFix({ code: "agentic.peer-rule" })).toMatchObject({ ok: false, field: "code" });
    controller.undo();
    expect(page.getState().checks.issues.some((i) => i.code === "agentic.peer-rule")).toBe(true);
  });

  it("refuses a build whose calls point at nothing", () => {
    const { page, controller } = setup();
    const before = controller.doc;
    const result = page.buildNetwork({
      name: "x",
      description: "d",
      entryPoint: "a",
      agents: [{ name: "a", description: "d", instructions: "i", calls: ["b"] }],
    });
    expect(result).toMatchObject({ ok: false, field: "agents[0].calls" });
    expect(controller.doc).toBe(before);
  });
});
