import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type { StudioController } from "../controller.ts";
import { sharedStyles } from "../styles/shared.ts";

const SEEN_KEY = "telar.welcomed.v1";

/** First-visit introduction: what Telar is, and three ways to start. */
@customElement("telar-welcome")
export class TelarWelcome extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  @query("dialog") private dialog!: HTMLDialogElement;

  /** Opens on the first visit only (or always when `force` is true). */
  async showIfNew(force = false): Promise<void> {
    await this.updateComplete;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Storage unavailable: show the welcome every time, which is harmless.
    }
    if ((force || !seen) && !this.dialog.open) this.dialog.showModal();
  }

  private finish(action: () => void): void {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    this.dialog.close();
    action();
  }

  override render() {
    return html`
      <dialog aria-labelledby="welcome-title">
        <svg class="weave" viewBox="0 0 320 64" aria-hidden="true">
          <path d="M0 16 H320 M0 32 H320 M0 48 H320" class="weft" />
          <path
            d="M20 4 V60 M60 4 V60 M100 4 V60 M140 4 V60 M180 4 V60 M220 4 V60 M260 4 V60 M300 4 V60"
            class="warp"
          />
          <circle cx="60" cy="16" r="7" class="k agent" />
          <circle cx="140" cy="32" r="7" class="k agent" />
          <circle cx="220" cy="48" r="7" class="k peer" />
          <circle cx="260" cy="16" r="7" class="k mcp" />
          <path
            d="M60 16 C 100 16, 100 32, 140 32 S 180 48, 220 48 M140 32 C 200 32, 200 16, 260 16"
            class="thread"
          />
        </svg>
        <h1 id="welcome-title">Weave agents for the open web</h1>
        <p>
          Telar is a visual studio for the
          <strong>open agentic web</strong>: websites that publish AI agents any visitor, or any other site's
          agents, can talk to.
        </p>
        <p>
          Draw your agents on the canvas, connect who can call whom, and Telar checks the result against the
          official specification as you go. When it's ready, export the files your website publishes.
        </p>
        <div class="choices">
          <button class="primary" @click=${() => this.finish(() => this.controller.loadSample())}>
            Explore the bakery example
          </button>
          <button @click=${() => this.finish(() => this.controller.newDocument())}>Start from scratch</button>
          <button
            class="ghost"
            @click=${() =>
              this.finish(() =>
                this.dispatchEvent(new CustomEvent("import-request", { bubbles: true, composed: true })),
              )}
          >
            Import a published site
          </button>
        </div>
        <p class="note">Nothing you make leaves your browser until you export it.</p>
      </dialog>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      dialog {
        width: min(560px, calc(100vw - 32px));
        border: 0;
        border-radius: 18px;
        padding: 28px 30px 24px;
        background: var(--surface);
        color: var(--ink);
        box-shadow: var(--shadow-lg);
      }
      dialog::backdrop {
        background: rgb(28 32 69 / 45%);
      }
      .weave {
        width: 100%;
        height: auto;
        margin-bottom: 8px;
      }
      .warp {
        stroke: var(--line-strong);
        stroke-width: 1.5;
      }
      .weft {
        stroke: var(--line);
        stroke-width: 1.5;
      }
      .thread {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.5;
        stroke-linecap: round;
      }
      .k {
        stroke: var(--surface);
        stroke-width: 3;
      }
      .k.agent {
        fill: var(--agent);
      }
      .k.peer {
        fill: var(--peer);
      }
      .k.mcp {
        fill: var(--mcp);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 28px;
        line-height: 1.1;
        font-weight: 700;
      }
      p {
        margin: 0 0 10px;
        color: var(--ink-2);
        line-height: 1.5;
        font-size: 14.5px;
      }
      .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 18px 0 14px;
      }
      .choices button {
        padding: 9px 14px;
        font-size: 14px;
      }
      .note {
        font-size: 12.5px;
        color: var(--ink-3);
        margin: 0;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-welcome": TelarWelcome;
  }
}
