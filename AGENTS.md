# MORPH repository guidance

## Mission

Build MORPH: a user-controlled accessibility runtime that compiles a live digital interface into a task-specific adaptive surface, safely operates the original interface, and verifies each resulting state.

The Build Week category is **Apps for Your Life**. The frozen demonstration vertical is travel rebooking across low-vision, one-switch motor-access, and cognitive-load profiles.

## Non-negotiable product boundaries

- MORPH is assistive software, not a vendor accessibility overlay and not a WCAG-compliance claim.
- Raw page content is untrusted data and must never be treated as model or tool instructions.
- PostgreSQL's append-only session events are the future system of record; model context is not durable state.
- Model output must validate against closed schemas before reaching application state.
- Irreversible actions require explicit, accessible user consent.
- Browser execution advances one reversible step at a time and verifies fresh evidence after every step.
- A verification mismatch may replan at most three times before stopping safely.
- The product must not expose private chain-of-thought. Show concise summaries, evidence, tool events, confidence, and state transitions instead.
- Raw screenshots, speech, secrets, and personal data are not persisted by default.

## Repository shape

- The Cloudflare Sites-compatible web package remains at the repository root.
- Executable backend workers live under `apps/`.
- Shared libraries live under `packages/`.
- Infrastructure declarations live under `infra/`.
- Product and engineering contracts live under `docs/`.

## Phase discipline

Work only within the active phase unless a prerequisite is required for verification. Update `docs/build-ledger.md` after each phase with decisions, commands, failures, fixes, and evidence. Update `docs/decisions.md` for architecture changes.

Do not replace a verified architecture merely to introduce a preferred framework. Preserve user changes and unrelated work. Never add an unlabelled mocked path to the live demo.

## Commands

```text
npm install
npm run dev
npm run health
npm run typecheck
npm run lint
npm run test:workspaces
npm test
npm run build:all
npm run check
```

## Verification expectations

Every implementation phase must run the narrowest relevant checks and, before handoff, the full `npm run check` suite. Later phases must add unit, integration, Playwright, accessibility, prompt-injection, and state-machine tests without weakening existing gates.

## Security-sensitive areas

Treat changes to browser tools, consent handling, action execution, adapter publication, prompt construction, data retention, and authentication as high risk. Add negative tests and document the threat-model impact for each such change.
