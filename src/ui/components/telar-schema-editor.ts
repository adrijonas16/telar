import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Json, JsonObject } from "../../core/index.ts";
import { sharedStyles } from "../styles/shared.ts";

type FieldType = "string" | "number" | "integer" | "boolean";
interface Field {
  name: string;
  type: FieldType;
  description: string;
  required: boolean;
}

const TYPES: FieldType[] = ["string", "number", "integer", "boolean"];

function isObject(v: Json | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Fields of a flat object schema, or null when the schema needs the JSON editor. */
export function toFields(schema: JsonObject | null): Field[] | null {
  if (!schema) return [];
  const allowedTop = new Set(["type", "properties", "required"]);
  if (schema.type !== "object" || Object.keys(schema).some((k) => !allowedTop.has(k))) return null;
  const props = schema.properties ?? {};
  if (!isObject(props)) return null;
  const required = Array.isArray(schema.required) ? schema.required : [];
  const fields: Field[] = [];
  for (const [name, def] of Object.entries(props)) {
    if (!isObject(def) || Object.keys(def).some((k) => k !== "type" && k !== "description")) return null;
    if (!TYPES.includes(def.type as FieldType)) return null;
    fields.push({
      name,
      type: def.type as FieldType,
      description: typeof def.description === "string" ? def.description : "",
      required: required.includes(name),
    });
  }
  return fields;
}

export function fromFields(fields: Field[]): JsonObject {
  const properties: JsonObject = {};
  for (const f of fields) {
    properties[f.name] = f.description ? { type: f.type, description: f.description } : { type: f.type };
  }
  const schema: JsonObject = { type: "object", properties };
  const required = fields.filter((f) => f.required).map((f) => f.name);
  if (required.length) schema.required = required;
  return schema;
}

/**
 * Edits an agent's input JSON Schema: a simple field list for flat schemas, raw JSON for
 * anything richer. Emits `schema-change` with `detail: JsonObject | null`.
 */
@customElement("telar-schema-editor")
export class TelarSchemaEditor extends LitElement {
  @property({ attribute: false }) schema: JsonObject | null = null;
  /** Changes when the edited node changes, resetting local editor state. */
  @property() ownerId = "";

  @state() private rawMode = false;
  @state() private rawText = "";
  @state() private rawError = "";
  private lastOwner = "";

  override willUpdate(): void {
    if (this.ownerId !== this.lastOwner) {
      this.lastOwner = this.ownerId;
      this.rawMode = toFields(this.schema) === null;
      this.rawText = JSON.stringify(this.schema ?? {}, null, 2);
      this.rawError = "";
    }
  }

  private emit(schema: JsonObject | null): void {
    this.dispatchEvent(new CustomEvent("schema-change", { detail: schema, bubbles: true, composed: true }));
  }

  private updateField(fields: Field[], index: number, patch: Partial<Field>): void {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    this.emit(fromFields(next));
  }

  private toggleRaw(): void {
    if (this.rawMode) {
      if (toFields(this.schema) === null) return;
      this.rawMode = false;
    } else {
      this.rawText = JSON.stringify(this.schema ?? {}, null, 2);
      this.rawError = "";
      this.rawMode = true;
    }
  }

  private onRawInput(event: Event): void {
    this.rawText = (event.target as HTMLTextAreaElement).value;
    if (!this.rawText.trim()) {
      this.rawError = "";
      this.emit(null);
      return;
    }
    try {
      const value = JSON.parse(this.rawText) as Json;
      if (!isObject(value)) throw new Error("The schema must be a JSON object.");
      this.rawError = "";
      this.emit(value);
    } catch (error) {
      this.rawError = (error as Error).message;
    }
  }

  override render() {
    const fields = toFields(this.schema);
    const canSimple = fields !== null;
    return html`
      <div class="head">
        <span class="title">Input schema</span>
        <button class="ghost small" ?disabled=${this.rawMode && !canSimple} @click=${this.toggleRaw}>
          ${this.rawMode ? "Edit as fields" : "Edit as JSON"}
        </button>
      </div>
      ${
        this.rawMode
          ? html`<textarea
                class="mono"
                rows="9"
                spellcheck="false"
                aria-label="Input JSON Schema"
                .value=${this.rawText}
                @input=${this.onRawInput}
              ></textarea>
              ${this.rawError ? html`<p class="error" role="alert">Not applied: ${this.rawError}</p>` : null}`
          : html`
              ${(fields ?? []).map(
                (f, i, all) => html`
                  <div class="field">
                    <input
                      aria-label="Field name"
                      .value=${f.name}
                      @change=${(e: Event) => this.updateField(all, i, { name: (e.target as HTMLInputElement).value.trim() })}
                    />
                    <select
                      aria-label="Field type"
                      .value=${f.type}
                      @change=${(e: Event) => this.updateField(all, i, { type: (e.target as HTMLSelectElement).value as FieldType })}
                    >
                      ${TYPES.map((t) => html`<option value=${t} ?selected=${t === f.type}>${t}</option>`)}
                    </select>
                    <label class="req" title="Required">
                      <input
                        type="checkbox"
                        .checked=${f.required}
                        @change=${(e: Event) => this.updateField(all, i, { required: (e.target as HTMLInputElement).checked })}
                      />
                      req.
                    </label>
                    <button
                      class="ghost small"
                      aria-label="Remove field ${f.name}"
                      @click=${() => this.emit(fromFields(all.filter((_, j) => j !== i)))}
                    >
                      ✕
                    </button>
                    <input
                      class="desc"
                      aria-label="Field description"
                      placeholder="Description"
                      .value=${f.description}
                      @change=${(e: Event) => this.updateField(all, i, { description: (e.target as HTMLInputElement).value })}
                    />
                  </div>
                `,
              )}
              <button
                class="small"
                @click=${() => {
                  const all = fields ?? [];
                  let name = "field";
                  let n = 2;
                  while (all.some((f) => f.name === name)) name = `field_${n++}`;
                  this.emit(fromFields([...all, { name, type: "string", description: "", required: false }]));
                }}
              >
                + Add field
              </button>
            `
      }
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: 8px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .title {
        font-size: 12px;
        font-weight: 600;
        color: var(--ink-2);
      }
      button.small {
        padding: 3px 8px;
        font-size: 12px;
      }
      .field {
        display: grid;
        grid-template-columns: 1fr 92px auto auto;
        gap: 6px;
        align-items: center;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
      }
      .field .desc {
        grid-column: 1 / -1;
      }
      .req {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 400;
      }
      .req input {
        width: auto;
      }
      .error {
        margin: 0;
        color: var(--error);
        font-size: 12px;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "telar-schema-editor": TelarSchemaEditor;
  }
}
