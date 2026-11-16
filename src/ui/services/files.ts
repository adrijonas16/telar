/** Browser file helpers: downloads and loading networks from a published agentic site. */
import {
  fromNetworkJson,
  ImportError,
  parseNetworkText,
  type JsonObject,
  type StudioDocument,
} from "../../core/index.ts";

export function download(filename: string, content: string | Uint8Array, type = "application/json"): void {
  const blob = new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchJson(url: string): Promise<JsonObject> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "omit" });
  } catch {
    throw new ImportError(
      `Could not reach ${url}. The site may be down, or it does not allow other sites to read its files (CORS).`,
    );
  }
  if (!response.ok) throw new ImportError(`${url} answered ${response.status} ${response.statusText}.`);
  return parseNetworkText(await response.text());
}

/**
 * Loads a network the way the reference runtime resolves a peer (MVP spec §3.2):
 * `https://site/base/<network>` → `https://site/base/agent-manifest.json` → its `hocon` file.
 * Also accepts a site base URL (first published network) or a direct `.network.json` URL.
 */
export async function importFromUrl(input: string): Promise<StudioDocument> {
  const url = new URL(input.trim());
  if (url.pathname.endsWith(".json") && !url.pathname.endsWith("agent-manifest.json")) {
    const name =
      url.pathname
        .split("/")
        .at(-1)
        ?.replace(/\.network\.json$|\.json$/, "") ?? "imported_network";
    return fromNetworkJson(await fetchJson(url.href), { name });
  }

  const candidates: Array<{ base: string; wanted?: string }> = [];
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.pathname.endsWith("agent-manifest.json")) {
    candidates.push({ base: new URL("./", url).href });
  } else {
    if (segments.length) {
      const parent = new URL(`/${segments.slice(0, -1).join("/")}${segments.length > 1 ? "/" : ""}`, url)
        .href;
      candidates.push({ base: parent, wanted: segments.at(-1) });
    }
    candidates.push({ base: url.href.endsWith("/") ? url.href : `${url.href}/` });
  }

  let lastError: unknown;
  for (const { base, wanted } of candidates) {
    try {
      const manifest = await fetchJson(new URL("agent-manifest.json", base).href);
      const networks = Array.isArray(manifest.networks) ? (manifest.networks as JsonObject[]) : [];
      const entry = wanted ? networks.find((n) => n.name === wanted) : networks[0];
      if (!entry) {
        throw new ImportError(
          `The site publishes no network named '${wanted}'. It publishes: ${networks.map((n) => n.name).join(", ") || "none"}.`,
        );
      }
      const network = await fetchJson(new URL(String(entry.hocon), base).href);
      const router = (manifest.llm_router as JsonObject | undefined)?.base_url;
      return fromNetworkJson(network, {
        name: String(entry.name),
        frontMan: typeof entry.front_man === "string" ? entry.front_man : undefined,
        description: typeof entry.description === "string" ? entry.description : undefined,
        brand: typeof manifest.brand === "string" ? manifest.brand : undefined,
        routerBaseUrl: typeof router === "string" ? router : undefined,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new ImportError("Could not load a network from that URL.");
}

export async function importFromFile(file: File): Promise<StudioDocument> {
  const name = file.name.replace(/\.network\.json$|\.json$/, "") || "imported_network";
  return fromNetworkJson(parseNetworkText(await file.text()), { name: name.replace(/[^A-Za-z0-9_-]/g, "_") });
}
