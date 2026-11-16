/** URL helpers shared by serialization and validation. */

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Loopback hosts may use plain HTTP during local development (MVP spec §3.2). */
export function isLoopback(url: URL): boolean {
  return LOOPBACK.has(url.hostname) || url.hostname.endsWith(".localhost");
}

/** The network name of a peer URL: its final non-empty path segment. */
export function peerNetworkName(value: string): string {
  const url = parseHttpUrl(value);
  if (!url) return value;
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? url.hostname;
}

/** A short label for a URL node: `host / network`. */
export function urlLabel(value: string): string {
  const url = parseHttpUrl(value);
  if (!url) return value || "(no URL)";
  return url.host;
}
