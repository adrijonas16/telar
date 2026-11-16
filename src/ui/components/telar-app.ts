import { css, html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { sharedStyles } from "../styles/shared.ts";
import type { ArtifactKind } from "./telar-artifacts.ts";
import type { TelarImportDialog } from "./telar-import-dialog.ts";
import type { TelarWelcome } from "./telar-welcome.ts";
import "./telar-toolbar.ts";
import "./telar-canvas.ts";
import "./telar-inspector.ts";
import "./telar-issues.ts";
import "./telar-artifacts.ts";
import "./telar-import-dialog.ts";
import "./telar-pieces.ts";
import "./telar-welcome.ts";

type PanelTab = "checks" | ArtifactKind;

function isTyping(event: KeyboardEvent): boolean {
  const el = event.composedPath()[0];
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
  );
}

/** Application shell: layout, global keyboard shortcuts, panels and notifications. */
@customElement("telar-app")
export class TelarApp extends LitElement {
  private readonly controller = new StudioController();
  private readonly binding = new StudioBinding(this, this.controller);

  @state() private panelTab: PanelTab = "checks";
  @state() private panelOpen = true;
  @query("telar-import-dialog") private importDialog!: TelarImportDialog;
  @query("telar-welcome") private welcome!: TelarWelcome;

  private readonly onKey = (event: KeyboardEvent) => {
    if (isTyping(event)) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.controller.redo();
      else this.controller.undo();
    } else if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      this.controller.redo();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (this.controller.state.selection) {
        event.preventDefault();
        this.controller.removeSelection();
      }
    } else if (event.key === "Escape") {
      this.controller.select(null);
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onKey);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onKey);
  }

  override firstUpdated(): void {
    this.controller.requestFit();
    void this.welcome.showIfNew();
  }

  private renderPanel() {
    const report = this.controller.report;
    const tabs: Array<[PanelTab, string]> = [
      ["checks", `Checks${report.issues.length ? ` (${report.issues.length})` : ""}`],
      ["network", "network.json"],
      ["manifest", "agent-manifest.json"],
      ["links", "links.json"],
    ];
    return html`
      <section class="panel ${this.panelOpen ? "open" : ""}" aria-label="Output">
        <div class="tabs" role="tablist">
          ${tabs.map(
            ([id, label]) =>
              html`<button
                role="tab"
                class="tab ${this.panelTab === id ? "active" : ""} ${id === "checks" && report.errors ? "has-errors" : ""}"
                aria-selected=${this.panelTab === id ? "true" : "false"}
                @click=${() => {
                  this.panelTab = id;
                  this.panelOpen = true;
                }}
              >
                ${label}
              </button>`,
          )}
          <span class="spacer"></span>
          <button
            class="ghost"
            aria-expanded=${this.panelOpen}
            @click=${() => (this.panelOpen = !this.panelOpen)}
          >
            ${this.panelOpen ? "Hide ▾" : "Show ▴"}
          </button>
        </div>
        ${
          this.panelOpen
            ? this.panelTab === "checks"
              ? html`<telar-issues .controller=${this.controller}></telar-issues>`
              : html`<telar-artifacts
                  .controller=${this.controller}
                  .artifact=${this.panelTab}
                ></telar-artifacts>`
            : null
        }
      </section>
    `;
  }

  override render() {
    return html`
      <telar-toolbar
        .controller=${this.controller}
        @import-request=${() => this.importDialog.show()}
        @show-welcome=${() => void this.welcome.showIfNew(true)}
        @show-checks=${() => {
          this.panelTab = "checks";
          this.panelOpen = true;
        }}
      ></telar-toolbar>
      <main>
        <telar-pieces .controller=${this.controller} aria-label="Pieces"></telar-pieces>
        <div class="work">
          <telar-canvas .controller=${this.controller}></telar-canvas>
          ${this.renderPanel()}
        </div>
        <telar-inspector .controller=${this.controller} aria-label="Properties"></telar-inspector>
      </main>
      <telar-import-dialog .controller=${this.controller}></telar-import-dialog>
      <telar-welcome
        .controller=${this.controller}
        @import-request=${() => this.importDialog.show()}
      ></telar-welcome>
      <div class="toasts" aria-live="polite">
        ${this.controller.toasts.map((t) => html`<div class="toast ${t.kind}" role=${t.kind === "error" ? "alert" : "status"}>${t.message}</div>`)}
      </div>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100vh;
        height: 100dvh;
      }
      main {
        display: grid;
        grid-template-columns: 264px minmax(0, 1fr) 380px;
        min-height: 0;
      }
      .work {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
        min-height: 0;
        min-width: 0;
      }
      telar-canvas {
        min-height: 0;
      }
      telar-pieces {
        border-right: 1px solid var(--line);
        min-height: 0;
      }
      telar-inspector {
        border-left: 1px solid var(--line);
        min-height: 0;
      }
      .panel {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto;
        border-top: 1px solid var(--line);
        background: var(--surface);
      }
      .panel.open {
        grid-template-rows: auto 200px;
      }
      .panel > :last-child {
        min-height: 0;
      }
      .tabs {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 4px 8px;
        border-bottom: 1px solid var(--line);
      }
      .tab {
        border-color: transparent;
        background: transparent;
        font-size: 12.5px;
      }
      .tab.active {
        background: var(--surface-2);
        border-color: var(--line);
        font-weight: 600;
      }
      .tab.has-errors {
        color: var(--error);
      }
      .spacer {
        flex: 1;
      }
      .toasts {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        display: grid;
        gap: 8px;
        z-index: 10;
        pointer-events: none;
      }
      .toast {
        padding: 9px 14px;
        border-radius: var(--radius);
        background: var(--ink);
        color: var(--paper);
        font-size: 13px;
        box-shadow: var(--shadow);
        max-width: 520px;
      }
      .toast.error {
        background: var(--error);
      }
      @media (max-width: 1180px) {
        main {
          grid-template-columns: 220px minmax(0, 1fr) 340px;
        }
      }
      @media (max-width: 860px) {
        main {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: auto 1fr 45%;
        }
        telar-pieces {
          border-right: 0;
          border-bottom: 1px solid var(--line);
          max-height: 160px;
        }
        telar-inspector {
          border-left: 0;
          border-top: 1px solid var(--line);
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-app": TelarApp;
  }
}
