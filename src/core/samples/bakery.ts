import { applyLayout } from "../layout/layered-layout.ts";
import { createAgent, createMcp, createPeer, DEFAULT_MODEL, DEFAULT_ROUTER } from "../model/factory.ts";
import type { StudioDocument } from "../model/types.ts";
import { PEER_RULE_TEXT } from "../agentic/peer-rule.ts";

/** A small, valid starter network showing every node kind. */
export function bakerySample(): StudioDocument {
  const front = createAgent({
    name: "bakery_assistant",
    description: "Helps visitors of Panadería Sol with the menu, orders and delivery.",
    instructions:
      "You are the front desk of Panadería Sol, a bakery in Lima. Understand the visitor's request and delegate it: " +
      "menu and allergen questions to menu_specialist, orders to order_specialist. Summarize their answers briefly. " +
      "Never invent products, prices or opening hours.\n\n" +
      PEER_RULE_TEXT,
  });
  const menu = createAgent({
    name: "menu_specialist",
    description: "Explains breads, pastries, ingredients, allergens and prices.",
    instructions:
      "Answer only from the current menu supplied by the website. If an item or ingredient is not listed, say you do not know.",
  });
  const orders = createAgent({
    name: "order_specialist",
    description: "Prepares pickup and delivery orders for visitor review.",
    instructions:
      "Collect the items, quantities, pickup or delivery choice and time. For delivery, ask the courier network for options. " +
      "Never confirm an order yourself: the visitor confirms it on the page.",
  });
  const courier = createPeer("https://courier.example/agents/lima_courier");
  const search = createMcp("https://tools.example/mcp", ["search_addresses"]);

  return applyLayout({
    version: 1,
    network: {
      name: "panaderia_sol",
      description:
        "Ask about Panadería Sol's breads and pastries, allergens and prices, and order for pickup or delivery.",
      sampleQueries: [
        "Which pastries are dairy-free?",
        "I need 20 empanadas for Saturday at 10 am, delivered to Miraflores. Can you help?",
      ],
      extra: {},
      metadataExtra: {},
    },
    site: { brand: "Panadería Sol", routerBaseUrl: DEFAULT_ROUTER, defaultModel: DEFAULT_MODEL },
    nodes: [front, menu, orders, courier, search],
    edges: [
      { from: front.id, to: menu.id },
      { from: front.id, to: orders.id },
      { from: orders.id, to: courier.id },
      { from: orders.id, to: search.id },
    ],
    frontAgentId: front.id,
  });
}
