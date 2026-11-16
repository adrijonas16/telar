import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { json, networkFileName, toLinks, toManifest, toNetworkJson } from "../../core/index.ts";
import type { StudioController } from "../controller.ts";
import { StudioBinding } from "../controller-binding.ts";
import { download } from "../services/files.ts";
import { sharedStyles } from "../styles/shared.ts";

export type ArtifactKind = "network" | "manifest" | "links";

/** Live, read-only preview of one published file, with copy and download. */
@customElement("telar-artifacts")
export class TelarArtifacts extends LitElement {
  @property({ attribute: false }) controller!: StudioController;
  @property() artifact: ArtifactKind = "network";
  private binding?: StudioBinding;

  override connectedCallback(): void {
    super.connectedCallback();
    this.binding ??= new StudioBinding(this, this.controller);
  }

  private file(): { name: string; text: string } {
    const doc = this.controller.doc;
    switch (this.artifact) {
      case "manifest":
        return { name: "agent-manifest.json", text: json(toManifest(doc)) };
      case "links":
        return { name: "links.json", text: json(toLinks(doc)) };
      default:
        return { name: networkFileName(doc), text: json(toNetworkJson(doc)) };
    }
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.controller.toast("Copied to the clipboard.");
    } catch {
      this.controller.toast(
        "The browser blocked clipboard access. Select the text and copy it instead.",
        "error",
      );
    }
  }

  override render() {
    const { name, text } = this.file();
    return html`
      <div class="bar">
        <code>${name}</code>
        <span class="spacer"></span>
        <button class="ghost" @click=${() => this.copy(text)}>Copy</button>
        <button class="ghost" @click=${() => download(name, text)}>Download</button>
      </div>
      <pre tabindex="0" aria-label=${`${name} preview`}>${text}</pre>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border-bottom: 1px solid var(--line);
      }
      .spacer {
        flex: 1;
      }
      code {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink-2);
      }
      pre {
        margin: 0;
        padding: 10px 14px;
        overflow: auto;
        flex: 1;
        font-family: var(--font-mono);
        font-size: 12px;
        line-height: 1.5;
        color: var(--ink);
        background: var(--surface-2);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-artifacts": TelarArtifacts;
  }
}
