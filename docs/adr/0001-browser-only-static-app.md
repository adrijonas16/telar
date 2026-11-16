# ADR 0001: Browser-only static app

- Status: accepted
- Date: 2026-11-16

## Context

The open agentic web runs agent networks in the visitor's browser and asks publishers not to
need server-side code. Existing Neuro SAN authoring tools (MAUI, the Agent Network Designer)
assume a hosted Neuro SAN server.

## Decision

Telar is a static single-page app with no backend. Editing, validation, layout and export run
client-side; drafts are kept in origin-scoped localStorage.

## Consequences

- Hostable for free on any static host; nothing to operate or secure server-side.
- Practises what the challenge preaches, and makes Telar itself eligible to become an open
  agentic website.
- Importing from other sites depends on their CORS headers, as the spec already requires
  for published artifacts.
- No sharing or collaboration beyond exported files, for now.
