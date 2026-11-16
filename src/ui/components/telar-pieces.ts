import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { NodeKind } from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { KIND_EXPLAINER, KIND_ICON, KIND_NAME } from "../icons.ts";
import { sharedStyles } from "../styles/shared.ts";

const STEPS = [
  ["Weave", "Add agents and connect who can call whom."],
  ["Check", "Fix what the checks flag until the network is conforming."],
  ["Publish", "Export the bundle and host it on any static site."],
] as const;

/** Left rail: the three kinds of pieces, explained in plain words, plus how Telar works. */
@customElement("telar-pieces")
export class TelarPieces extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  private binding?: StudioBinding;

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
  }

  override render() {
    const parent = this.controller.selectedNode;
    const target =
      parent?.kind === "agent"
        ? html`New pieces are connected to <strong>${parent.name}</strong>.`
        : html`Select an agent first to connect new pieces to it.`;
    return html`
      <h2>Pieces</h2>
      <p class="lead">${target}</p>
      <ul class="pieces">
        ${(["agent", "peer", "mcp"] as NodeKind[]).map(
          (kind) =>
            html`<li>
              <button class="piece ${kind}" @click=${() => this.controller.addNode(kind)}>
                <span class="tile" aria-hidden="true"><svg viewBox="0 0 24 24">${KIND_ICON[kind]}</svg></span>
                <span class="text">
                  <span class="name"
                    >Add ${KIND_NAME[kind].charAt(0).toLowerCase() + KIND_NAME[kind].slice(1)}</span
                  >
                  <span class="explainer">${KIND_EXPLAINER[kind]}</span>
                </span>
              </button>
            </li>`,
        )}
      </ul>

      <h2>How it works</h2>
      <ol class="steps">
        ${STEPS.map(
          ([name, text], i) =>
            html`<li>
              <span class="n" aria-hidden="true">${i + 1}</span>
              <span><strong>${name}.</strong> ${text}</span>
            </li>`,
        )}
      </ol>
      <p class="foot">
        Telar follows the
        <a
          href="https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md"
          target="_blank"
          rel="noopener"
          >open agentic web specification</a
        >. Everything runs in your browser.
      </p>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px 16px;
        overflow: auto;
        background: var(--surface);
      }
      h2 {
        margin: 6px 0 0;
        font-size: 17px;
        font-weight: 700;
      }
      .lead {
        margin: 0;
        font-size: 12.5px;
        color: var(--ink-2);
      }
      ul,
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .piece {
        width: 100%;
        white-space: normal;
        text-align: left;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: var(--radius);
        border: 1px solid var(--line);
        background: var(--surface);
      }
      .piece:hover:not(:disabled) {
        border-color: currentColor;
        background: var(--surface);
      }
      .piece.agent {
        color: var(--agent);
      }
      .piece.peer {
        color: var(--peer);
      }
      .piece.mcp {
        color: var(--mcp);
      }
      .tile {
        flex: none;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 9px;
      }
      .agent .tile {
        background: var(--agent-soft);
      }
      .peer .tile {
        background: var(--peer-soft);
      }
      .mcp .tile {
        background: var(--mcp-soft);
      }
      .tile svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .text {
        display: grid;
        gap: 3px;
      }
      .name {
        font-weight: 700;
        font-size: 13.5px;
      }
      .explainer {
        color: var(--ink-2);
        font-size: 12.5px;
        line-height: 1.4;
      }
      .steps li {
        display: flex;
        gap: 10px;
        font-size: 12.5px;
        color: var(--ink-2);
        line-height: 1.45;
      }
      .steps strong {
        color: var(--ink);
      }
      .n {
        flex: none;
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--ink);
        color: var(--surface);
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 12px;
      }
      .foot {
        margin: auto 0 0;
        padding-top: 12px;
        font-size: 12px;
        color: var(--ink-3);
      }
      a {
        color: var(--agent);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-pieces": TelarPieces;
  }
}
