import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { bundleZip, json, networkFileName, toManifest, toNetworkJson } from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { download } from "../services/files.ts";
import { sharedStyles } from "../styles/shared.ts";

function emit(el: HTMLElement, name: string): void {
  el.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
}

/**
 * Top bar: brand, document menu, history, and the three-step progress
 * (weave → check → publish) that doubles as navigation. Emits `import-request`,
 * `show-checks` and `show-welcome`; the shell owns those surfaces.
 */
@customElement("telar-toolbar")
export class TelarToolbar extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  @state() private assistantOpen = false;
  private binding?: StudioBinding;
  private readonly onAssistantToggle = (e: Event) => {
    this.assistantOpen = (e as CustomEvent<boolean>).detail;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
    document.addEventListener("assistant-toggle", this.onAssistantToggle);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("assistant-toggle", this.onAssistantToggle);
  }

  private closeMenus(): void {
    this.renderRoot.querySelectorAll<HTMLElement>("[popover]").forEach((p) => {
      if (p.matches(":popover-open")) p.hidePopover();
    });
  }

  /** Anchors an opening popover menu under the button that opened it. */
  private placeMenu(event: ToggleEvent): void {
    if (event.newState !== "open") return;
    const menu = event.target as HTMLElement;
    const button = this.renderRoot.querySelector<HTMLElement>(`[popovertarget="${menu.id}"]`);
    if (!button) return;
    const r = button.getBoundingClientRect();
    const alignRight = menu.classList.contains("right");
    menu.style.top = `${r.bottom + 6}px`;
    menu.style.left = alignRight ? "auto" : `${r.left}px`;
    menu.style.right = alignRight ? `${window.innerWidth - r.right}px` : "auto";
  }

  private exportBundle(): void {
    const c = this.controller;
    if (!c.report.conforming) {
      c.toast(`Exported, but ${c.report.errors} check(s) still fail. Fix them before you publish.`, "error");
    } else {
      c.toast(`Exported ${c.doc.network.name}.zip. Unzip it next to the runtime and host the folder.`);
    }
    download(`${c.doc.network.name}.zip`, bundleZip(c.doc), "application/zip");
    this.closeMenus();
  }

  override render() {
    const c = this.controller;
    const report = c.report;
    const agents = c.doc.nodes.filter((n) => n.kind === "agent").length;
    const checkLabel = report.conforming
      ? report.warnings
        ? `Passing, ${report.warnings} tip${report.warnings > 1 ? "s" : ""}`
        : "All checks pass"
      : `${report.errors} to fix`;

    return html`
      <div class="brand">
        <svg viewBox="0 0 28 28" aria-hidden="true" class="logo">
          <rect width="28" height="28" rx="7" class="logo-bg" />
          <path d="M5 9.5h18M5 14h18M5 18.5h18" class="logo-weft" />
          <path d="M9.5 5v18M14 5v18M18.5 5v18" class="logo-warp" />
        </svg>
        <span class="name">Telar</span>
      </div>

      <div class="group">
        <button class="ghost" popovertarget="file-menu">File</button>
        <div
          id="file-menu"
          popover
          @beforetoggle=${this.placeMenu}
          class="menu"
          @click=${() => this.closeMenus()}
        >
          <button class="ghost" @click=${() => c.newDocument()}>New network</button>
          <button class="ghost" @click=${() => c.loadSample()}>Open the bakery example</button>
          <button class="ghost" @click=${() => emit(this, "import-request")}>Import a network…</button>
          <hr />
          <button class="ghost" @click=${() => emit(this, "show-welcome")}>What is Telar?</button>
        </div>
        <button
          class="ghost icon"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          ?disabled=${!c.store.canUndo}
          @click=${() => c.undo()}
        >
          ↶
        </button>
        <button
          class="ghost icon"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          ?disabled=${!c.store.canRedo}
          @click=${() => c.redo()}
        >
          ↷
        </button>
        <button class="ghost" title="Arrange cards by delegation level" @click=${() => c.autoLayout()}>
          Tidy up
        </button>
      </div>

      <ol class="steps" aria-label="Progress">
        <li class="step done">
          <span class="n">1</span>
          <span class="label"
            ><strong>Weave</strong><small>${agents} agent${agents === 1 ? "" : "s"}</small></span
          >
        </li>
        <li class="sep" aria-hidden="true"></li>
        <li class="step ${report.conforming ? "done" : "todo"}">
          <button class="step-btn" @click=${() => emit(this, "show-checks")}>
            <span class="n">${report.conforming ? "✓" : "2"}</span>
            <span class="label"><strong>Check</strong><small>${checkLabel}</small></span>
          </button>
        </li>
        <li class="sep" aria-hidden="true"></li>
        <li class="step ${report.conforming ? "ready" : ""}">
          <span class="n">3</span>
          <span class="label"
            ><strong>Publish</strong
            ><small>${report.conforming ? "Ready to export" : "After the checks"}</small></span
          >
        </li>
      </ol>

      <div class="group end">
        <button
          class="ask ${this.assistantOpen ? "on" : ""}"
          aria-expanded=${this.assistantOpen ? "true" : "false"}
          aria-controls="assistant"
          title="Telar's own agent builds and explains networks for you"
          @click=${() => emit(this, "toggle-assistant")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
            <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
          </svg>
          Ask Telar
        </button>
        <button class="primary" popovertarget="export-menu">Export</button>
        <div id="export-menu" popover @beforetoggle=${this.placeMenu} class="menu right">
          <button class="ghost" @click=${() => this.exportBundle()}>
            <span><strong>Site bundle (.zip)</strong><small>Everything your site publishes</small></span>
          </button>
          <button
            class="ghost"
            @click=${() => {
              download(networkFileName(c.doc), json(toNetworkJson(c.doc)));
              this.closeMenus();
            }}
          >
            <span><strong>${networkFileName(c.doc)}</strong><small>The agent network only</small></span>
          </button>
          <button
            class="ghost"
            @click=${() => {
              download("agent-manifest.json", json(toManifest(c.doc)));
              this.closeMenus();
            }}
          >
            <span><strong>agent-manifest.json</strong><small>The site's index of networks</small></span>
          </button>
        </div>
      </div>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: auto auto 1fr auto;
        align-items: center;
        gap: 16px;
        padding: 8px 14px;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .logo {
        width: 28px;
        height: 28px;
      }
      .logo-bg {
        fill: var(--ink);
      }
      .logo-weft {
        stroke: rgb(255 255 255 / 35%);
        stroke-width: 2;
      }
      .logo-warp {
        stroke: var(--accent);
        stroke-width: 2.4;
        stroke-dasharray: 3 1.5;
      }
      .name {
        font-family: var(--font-display);
        font-weight: 750;
        font-size: 20px;
        letter-spacing: -0.02em;
      }
      .group {
        display: flex;
        gap: 2px;
        align-items: center;
      }
      .group.end {
        justify-self: end;
        gap: 8px;
      }
      .ask {
        border-color: var(--agent);
        color: var(--agent);
        font-weight: 700;
      }
      .ask svg {
        width: 17px;
        height: 17px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ask:hover:not(:disabled) {
        background: var(--agent-soft);
        border-color: var(--agent);
      }
      .ask.on {
        background: var(--agent);
        color: #fff;
      }
      button.icon {
        font-size: 16px;
        padding: 4px 9px;
      }
      .steps {
        justify-self: center;
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .step,
      .step-btn {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .step-btn {
        border: 0;
        background: transparent;
        padding: 4px 8px;
        border-radius: var(--radius);
      }
      .step-btn:hover:not(:disabled) {
        background: var(--surface-2);
        border-color: transparent;
      }
      .n {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 12.5px;
        background: var(--surface-2);
        border: 1.5px solid var(--line-strong);
        color: var(--ink-2);
      }
      .step.done .n {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--surface);
      }
      .step.todo .n {
        background: var(--error-soft);
        border-color: var(--error);
        color: var(--error);
      }
      .step.ready .n {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-ink);
      }
      .label {
        display: grid;
        line-height: 1.2;
        text-align: left;
      }
      .label strong {
        font-size: 13px;
      }
      .label small {
        font-size: 11.5px;
        color: var(--ink-3);
      }
      .step.todo small {
        color: var(--error);
      }
      .sep {
        width: 28px;
        height: 2px;
        border-radius: 1px;
        background: var(--line-strong);
      }
      .menu {
        margin: 0;
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
        box-shadow: var(--shadow);
        flex-direction: column;
        min-width: 240px;
        position: fixed;
        inset: auto;
      }
      .menu:popover-open {
        display: flex;
      }
      .menu button {
        justify-content: flex-start;
        width: 100%;
        text-align: left;
      }
      .menu span {
        display: grid;
      }
      .menu small {
        color: var(--ink-3);
        font-size: 11.5px;
      }
      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 4px 0;
        width: 100%;
      }
      @media (max-width: 1100px) {
        .label small {
          display: none;
        }
      }
      @media (max-width: 860px) {
        .steps {
          display: none;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-toolbar": TelarToolbar;
  }
}
