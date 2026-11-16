/**
 * Mounts "Ask Telar", the studio's own agent, using the open agentic web reference runtime.
 *
 * Adapted from the agentify-website skill's `templates/site.js` (Apache-2.0). The runtime
 * (public/runtime/, copied unchanged) looks its mount up with document.querySelector, so the
 * assistant lives in the light DOM drawer declared in index.html, not inside a shadow root.
 *
 * The runtime is ~2 MB, so it loads the first time the visitor opens the drawer. Telar has
 * no irreversible actions (every canvas change is one undo step), so no custom confirmation
 * dialog is needed; partner consent keeps the runtime's own card.
 */

interface RuntimeEngine {
  mockLLM?: boolean;
  byokKey?: string;
  onConsent: (info: unknown) => Promise<unknown>;
}

const GREETING =
  "Hi! I can design an agent network for your website, change the one on the canvas, or explain what the checks mean. Try: “Create a network for a bakery that answers menu questions and takes orders.”";

export class AssistantMount {
  private static booting: Promise<RuntimeEngine | null> | null = null;

  /** Boots the runtime once; later calls return the same promise. */
  static start(): Promise<RuntimeEngine | null> {
    AssistantMount.booting ??= AssistantMount.boot();
    return AssistantMount.booting;
  }

  private static async boot(): Promise<RuntimeEngine | null> {
    const status = document.querySelector<HTMLElement>("#assistant-status");
    const siteBase = new URL("./", document.baseURI).href;
    try {
      const runtimeUrl = new URL("runtime/index.js", siteBase).href;
      const { boot } = (await import(/* @vite-ignore */ runtimeUrl)) as {
        boot: (selector: string, options: object) => Promise<{ engine: RuntimeEngine }>;
      };
      const booted = await boot("#agent-app", {
        originUrl: siteBase,
        sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
      });
      const engine = booted.engine;
      const defaultConsent = engine.onConsent.bind(engine);
      engine.onConsent = async (info: unknown) => {
        const answer = defaultConsent(info);
        AssistantMount.focusConsentCard();
        const decision = await answer;
        AssistantMount.keepFocusInChat();
        return decision;
      };
      // Same test as the runtime's "API key required" badge in runtime/ui.js.
      const needsKey = !engine.mockLLM && (!engine.byokKey || engine.byokKey === "demo");
      if (status) {
        status.textContent = needsKey
          ? "Add your AI provider key in AI model settings below to start chatting."
          : "Connected. Ask Telar to build or explain a network.";
      }
      if (!needsKey) AssistantMount.greet();
      return engine;
    } catch (error) {
      // The studio must keep working without the assistant.
      if (status) status.textContent = "The assistant could not load. The studio still works without it.";
      console.error("Assistant startup failed", error);
      AssistantMount.booting = null;
      return null;
    }
  }

  /** Replaces the runtime's generic first message with Telar's greeting. */
  static greet(): void {
    const first = document.querySelector("#ns-msgs .ns-msg.bot");
    if (first) first.textContent = GREETING;
  }

  /** Names the newest consent card for screen readers and moves focus to its title. */
  private static focusConsentCard(): void {
    const cards = document.querySelectorAll("#ns-msgs .ns-consent");
    const card = cards[cards.length - 1];
    const title = card?.querySelector<HTMLElement>(".ns-consent-title");
    if (!card || !title) return;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", title.textContent ?? "");
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest("#agent-app")) return;
    title.tabIndex = -1;
    title.focus();
  }

  /** Puts focus back in the chat input when a card or dialog left it on the body. */
  private static keepFocusInChat(): void {
    if (document.activeElement === document.body || document.activeElement === null) {
      document.querySelector<HTMLElement>("#ns-input")?.focus();
    }
  }
}

/** Opens or closes the drawer; booting the runtime on first open. */
export function setAssistantOpen(open: boolean): void {
  const drawer = document.querySelector<HTMLElement>("#assistant");
  if (!drawer) return;
  drawer.hidden = !open;
  document.body.classList.toggle("assistant-open", open);
  if (open) {
    void AssistantMount.start();
    drawer.querySelector<HTMLElement>("#assistant-heading")?.focus();
  }
  document.dispatchEvent(new CustomEvent("assistant-toggle", { detail: open }));
}

export function isAssistantOpen(): boolean {
  return !(document.querySelector<HTMLElement>("#assistant")?.hidden ?? true);
}
