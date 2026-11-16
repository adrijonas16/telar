/**
 * Heuristic detection of credentials pasted into public artifacts.
 * The spec forbids placing a user key in the network specification (MVP spec §4), and
 * everything in a published network is public (§2.2).
 */
const PATTERNS: Array<[string, RegExp]> = [
  ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{16,}/],
  ["Otari key", /\botk_[A-Za-z0-9_-]{8,}/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{16,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
  ["Private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

/** Returns the kind of credential found in `text`, or null. */
export function findSecret(text: string): string | null {
  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}
