/**
 * Public API of Telar's core: model, commands, store, serialization, validation, layout and
 * bundling. Framework- and DOM-free; the UI and (later) the studio's own agent tools both
 * build on this surface only.
 */
export type * from "./model/types.ts";
export * from "./model/factory.ts";
export * as commands from "./model/commands.ts";
export { Store, type Selection, type StudioState } from "./store/store.ts";
export {
  toNetworkJson,
  fromNetworkJson,
  parseNetworkText,
  ImportError,
  isCodedAgent,
} from "./serialize/network.ts";
export { toManifest, toLinks, networkFileName, frontAgent, peerOrigins } from "./serialize/manifest.ts";
export {
  validate,
  applyFix,
  RULES,
  type Issue,
  type ValidationReport,
  type Severity,
} from "./validate/index.ts";
export { applyLayout, NODE_WIDTH, NODE_HEIGHT } from "./layout/layered-layout.ts";
export { bundleFiles, bundleZip, json } from "./bundle/bundle.ts";
export { bakerySample } from "./samples/bakery.ts";
export { urlLabel, peerNetworkName } from "./util/urls.ts";
export { AGENT_NAME_PATTERN } from "./validate/rules/agent-rules.ts";
export { NETWORK_NAME_PATTERN } from "./validate/rules/network-rules.ts";
export { isSecurePeerUrl } from "./serialize/manifest.ts";
export { PEER_RULE_TEXT, PEER_RULE_MARKER, hasPeerRule, withPeerRule } from "./agentic/peer-rule.ts";
