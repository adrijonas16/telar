import { css } from "lit";

/** Control styles shared by every component (buttons, fields, chips). */
export const sharedStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  :host {
    font-family: var(--font-sans);
    color: var(--ink);
  }
  button {
    font: inherit;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 120ms,
      border-color 120ms;
  }
  button:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--ink-3);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
  }
  button.ghost {
    border-color: transparent;
    background: transparent;
  }
  button.ghost:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--line);
  }
  button.danger {
    color: var(--error);
    border-color: color-mix(in srgb, var(--error) 35%, transparent);
  }
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
  }
  .hint {
    font-weight: 400;
    color: var(--ink-3);
    font-size: 12px;
    line-height: 1.4;
  }
  input,
  textarea,
  select {
    font: inherit;
    font-size: 13px;
    font-weight: 400;
    color: var(--ink);
    width: 100%;
    padding: 7px 9px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  textarea {
    resize: vertical;
    line-height: 1.45;
  }
  textarea.mono,
  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }
  h1,
  h2,
  h3 {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink-2);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
`;
