import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { fromNetworkJson, parseNetworkText, type StudioDocument } from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { importFromFile, importFromUrl } from "../services/files.ts";
import { sharedStyles } from "../styles/shared.ts";

type Tab = "url" | "file" | "paste";

const EXAMPLES = [
  {
    label: "Official pizza restaurant example",
    url: "https://raw.githubusercontent.com/cognizant-ai-labs/agentic-web/main/examples/pizza_restaurant_agentified/agent-manifest.json",
  },
  {
    label: "Official guesthouse example",
    url: "https://raw.githubusercontent.com/cognizant-ai-labs/agentic-web/main/examples/guesthouse_agentified/agent-manifest.json",
  },
];

/** Modal (native <dialog>) to load a network from a published site, a file, or pasted JSON. */
@customElement("telar-import-dialog")
export class TelarImportDialog extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  @state() private tab: Tab = "url";
  @state() private busy = false;
  @state() private error = "";
  @state() private url = "";
  @state() private text = "";
  @query("dialog") private dialog!: HTMLDialogElement;

  show(): void {
    this.error = "";
    this.dialog.showModal();
  }

  private close(): void {
    this.dialog.close();
  }

  private async run(load: () => Promise<StudioDocument>, source: string): Promise<void> {
    this.busy = true;
    this.error = "";
    try {
      const doc = await load();
      this.controller.open(doc, `Imported ${source}.`);
      this.close();
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
    }
  }

  private renderTab() {
    switch (this.tab) {
      case "url":
        return html`
          <label>
            Agentic site or network URL
            <input
              class="mono"
              type="url"
              placeholder="https://site.example/agents/network_name"
              .value=${this.url}
              @input=${(e: Event) => (this.url = (e.target as HTMLInputElement).value)}
            />
            <span class="hint">
              A network URL, a site's base URL, its agent-manifest.json, or a .network.json file. The site
              must allow other origins to read its files (CORS).
            </span>
          </label>
          <div class="examples">
            ${EXAMPLES.map(
              (ex) => html`<button class="ghost" @click=${() => (this.url = ex.url)}>${ex.label}</button>`,
            )}
          </div>
          <footer>
            <button @click=${this.close}>Cancel</button>
            <button
              class="primary"
              ?disabled=${!this.url.trim() || this.busy}
              @click=${() => this.run(() => importFromUrl(this.url), new URL(this.url).host)}
            >
              ${this.busy ? "Loading…" : "Import"}
            </button>
          </footer>
        `;
      case "file":
        return html`
          <label>
            Network definition file
            <input
              type="file"
              accept=".json,application/json"
              @change=${(e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void this.run(() => importFromFile(file), file.name);
              }}
            />
            <span class="hint">A resolved <code>.network.json</code> file.</span>
          </label>
          <footer><button @click=${this.close}>Cancel</button></footer>
        `;
      case "paste":
        return html`
          <label>
            Network JSON
            <textarea
              class="mono"
              rows="12"
              spellcheck="false"
              placeholder='{ "metadata": { ... }, "tools": [ ... ] }'
              .value=${this.text}
              @input=${(e: Event) => (this.text = (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
          <footer>
            <button @click=${this.close}>Cancel</button>
            <button
              class="primary"
              ?disabled=${!this.text.trim()}
              @click=${() => this.run(async () => fromNetworkJson(parseNetworkText(this.text)), "pasted JSON")}
            >
              Import
            </button>
          </footer>
        `;
    }
  }

  override render() {
    const tabs: Array<[Tab, string]> = [
      ["url", "From a site"],
      ["file", "Open file"],
      ["paste", "Paste JSON"],
    ];
    return html`
      <dialog aria-labelledby="import-title" @close=${() => (this.busy = false)}>
        <h2 id="import-title">Import an agent network</h2>
        <p class="hint">
          Importing replaces the current canvas. Export first if you want to keep what is there now.
        </p>
        <div role="tablist">
          ${tabs.map(
            ([id, label]) =>
              html`<button
                role="tab"
                aria-selected=${this.tab === id ? "true" : "false"}
                class=${this.tab === id ? "active" : "ghost"}
                @click=${() => {
                  this.tab = id;
                  this.error = "";
                }}
              >
                ${label}
              </button>`,
          )}
        </div>
        <div class="panel" role="tabpanel">${this.renderTab()}</div>
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : null}
      </dialog>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      dialog {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 22px;
        background: var(--surface);
        color: var(--ink);
        box-shadow: 0 24px 60px rgb(31 28 44 / 25%);
      }
      dialog::backdrop {
        background: rgb(31 28 44 / 35%);
      }
      h2 {
        margin: 0 0 6px;
        font-size: 18px;
      }
      [role="tablist"] {
        display: flex;
        gap: 4px;
        margin: 14px 0;
      }
      [role="tab"].active {
        background: var(--ink);
        color: var(--paper);
        border-color: var(--ink);
      }
      .panel {
        display: grid;
        gap: 12px;
      }
      .examples {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .examples button {
        font-size: 12px;
        color: var(--agent);
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .error {
        margin: 12px 0 0;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        background: var(--error-soft);
        color: var(--error);
        font-size: 13px;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-import-dialog": TelarImportDialog;
  }
}
