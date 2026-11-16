import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Issue } from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { sharedStyles } from "../styles/shared.ts";

/** Lists every validation issue; clicking one selects the node it is about. */
@customElement("telar-issues")
export class TelarIssues extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  private binding?: StudioBinding;

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
  }

  private open(issue: Issue): void {
    if (issue.nodeId) this.controller.select({ type: "node", id: issue.nodeId });
    else this.controller.select(null);
  }

  override render() {
    const report = this.controller.report;
    return html`
      <div class="summary ${report.conforming ? "ok" : "bad"}" role="status">
        ${
          report.conforming
            ? html`<strong>✓ Conforming.</strong> This network passes the reference runtime's validation and
                Telar's specification
                checks${report.warnings ? html`, with ${report.warnings} suggestion${report.warnings > 1 ? "s" : ""}` : ""}.`
            : html`<strong>${report.errors} error${report.errors > 1 ? "s" : ""}</strong> to fix before
                publishing${
                  report.warnings
                    ? html`, plus ${report.warnings} suggestion${report.warnings > 1 ? "s" : ""}`
                    : ""
                }.`
        }
      </div>
      <ul>
        ${report.issues.map(
          (i) =>
            html`<li>
              <button class="issue ${i.severity}" @click=${() => this.open(i)}>
                <span class="sev">${i.severity === "error" ? "●" : "▲"}</span>
                <span class="msg">${i.message}</span>
                <span class="meta">
                  ${i.source === "reference-runtime" ? html`<span class="chip runtime">runtime</span>` : ""}
                  ${i.specRef ? html`<span class="chip">spec ${i.specRef}</span>` : ""}
                  <span class="chip code">${i.code}</span>
                </span>
              </button>
            </li>`,
        )}
      </ul>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        overflow: auto;
        padding: 10px 14px 14px;
      }
      .summary {
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        font-size: 13px;
      }
      .summary.ok {
        background: var(--ok-soft);
        color: var(--ok);
      }
      .summary.bad {
        background: var(--error-soft);
        color: var(--error);
      }
      ul {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
        display: grid;
        gap: 2px;
      }
      button.issue {
        width: 100%;
        border: 0;
        background: transparent;
        justify-content: flex-start;
        text-align: left;
        white-space: normal;
        padding: 6px 8px;
        align-items: baseline;
      }
      button.issue:hover {
        background: var(--surface-2);
      }
      .sev {
        flex: none;
        font-size: 11px;
      }
      .error .sev {
        color: var(--error);
      }
      .warning .sev {
        color: var(--warning);
      }
      .msg {
        flex: 1;
        line-height: 1.4;
      }
      .meta {
        display: flex;
        gap: 4px;
        flex: none;
      }
      .chip.code {
        font-family: var(--font-mono);
        font-weight: 400;
      }
      .chip.runtime {
        background: var(--agent-soft);
        color: var(--agent);
        border-color: transparent;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-issues": TelarIssues;
  }
}
