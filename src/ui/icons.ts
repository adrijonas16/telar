/**
 * Icon geometry shared by HTML (palette, inspector) and the SVG canvas. 24×24 viewBox,
 * stroked, so one definition renders crisply at every size.
 */
import { svg } from "lit";
import type { NodeKind } from "../core/index.ts";

export const KIND_ICON: Record<NodeKind, ReturnType<typeof svg>> = {
  // A knot: the agent as a point where threads meet.
  agent: svg`<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v5.3M12 16.2v5.3M2.5 12h5.3M16.2 12h5.3"/>`,
  // A globe: another site on the web.
  peer: svg`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/>`,
  // A plug: a tool server.
  mcp: svg`<path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0V8zM12 17v4"/>`,
};

export const KIND_NAME: Record<NodeKind, string> = {
  agent: "Agent",
  peer: "Another site's agents",
  mcp: "Tool server (MCP)",
};

export const KIND_EXPLAINER: Record<NodeKind, string> = {
  agent: "An AI helper with its own role and instructions. It can answer, or hand work to others.",
  peer: "A network published by another website. Your agents can ask it questions, with the visitor's consent.",
  mcp: "A server with tools agents can call, such as search or a database lookup.",
};
