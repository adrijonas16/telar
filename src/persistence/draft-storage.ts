/**
 * Keeps the current draft in this browser (origin-scoped localStorage) so a reload does not
 * lose work. Storage can be unavailable (private mode, sandboxed iframes, quota), so every
 * access is guarded and failure only means "no autosave".
 */
import type { StudioDocument } from "../core/index.ts";

const KEY = "telar.draft.v1";

export function loadDraft(): StudioDocument | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const doc = JSON.parse(text) as StudioDocument;
    return doc && doc.version === 1 && Array.isArray(doc.nodes) && Array.isArray(doc.edges) ? doc : null;
  } catch {
    return null;
  }
}

export function saveDraft(doc: StudioDocument): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Autosave is a convenience; ignore storage errors.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
