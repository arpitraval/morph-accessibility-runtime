# MORPH product specification

- Status: **FROZEN for Build Week v0.1**
- Frozen: 2026-07-14
- Track: Apps for Your Life
- Demonstration vertical: travel rebooking
- Product promise: Any interface. Any body. One intent.

## 1. Product thesis

MORPH is a user-controlled accessibility runtime that transforms a live, inaccessible digital interface into a task-specific adaptive control surface. It then operates the original interface one reversible step at a time, verifies fresh evidence after each action, and requires explicit accessible consent before any irreversible action.

MORPH does not audit a page, summarize its contents, or claim to repair the publisher's WCAG compliance. It helps a person complete a concrete task despite the original interface.

## 2. Problem and strategic target

The World Health Organization estimates that 1.3 billion people, or 16% of the global population, experience significant disability: https://www.who.int/news-room/fact-sheets/detail/disability-and-health

The WebAIM Million 2026 report found detectable WCAG failures on 95.9% of the top one million home pages and an average of 56.1 detectable errors per page: https://webaim.org/projects/million/

The supply-side accessibility model cannot retrofit every interface quickly enough. MORPH moves task adaptation to the user's edge while preserving user agency and explicit consent.

## 3. Frozen Build Week audience

The primary judge-visible user is an adult traveler who encounters an inaccessible rebooking flow after a disrupted journey.

MORPH must support these three profile presets:

1. **Low vision**
   - high contrast and scalable typography
   - large, stable targets
   - screen-reader-compatible names and status announcements
   - no meaning conveyed by color alone
2. **One-switch motor access**
   - deterministic scanning order
   - one primary action per scan stop
   - no time-limited interaction
   - explicit confirmation with a reversible back path
3. **Cognitive-load reduction**
   - plain language
   - at most three choices at once
   - visible progress and constraints
   - consistent placement and no surprise navigation

English is required. Hindi presentation is a stretch goal only after the core three-profile path is verified.

## 4. Frozen demonstration scenario

The repository will include a deterministic travel portal with seeded fares and at least five layout/DOM variants. The portal is intentionally difficult to use and is part of the test fixture, not evidence that MORPH repairs third-party websites.

User goal:

> Move tomorrow's disrupted journey to an option below INR 8,000. Do not purchase without my confirmation.

Required constraints:

- travel date is tomorrow in the fixture's declared timezone
- total price is at or below INR 8,000
- passenger identity remains unchanged
- no add-on may be selected implicitly
- final purchase is irreversible and requires accessible confirmation

The visible recovery moment is mandatory: after the target layout mutates, MORPH must re-observe the interface, detect a mismatched or stale action assumption, replan, and continue without losing the user's intent.

## 5. Functional requirements

### FR-001 ? Session capture

A session accepts an access profile, natural-language intent, target-interface observations, and explicit constraints. Every input becomes a typed event.

### FR-002 ? Surface normalization

MORPH produces a `SurfaceGraph` from screenshot, DOM, accessibility-tree, and page-state evidence. Conflicts between modalities remain visible rather than being silently resolved.

### FR-003 ? Intent contract

MORPH produces an `IntentGraph` containing the goal, invariants, prohibitions, ambiguities, success evidence, and consent boundaries.

### FR-004 ? Adaptive compilation

MORPH produces a closed `AdaptiveUIManifest`. The web client renders the manifest through a deterministic accessible component grammar; model-authored arbitrary JavaScript is forbidden.

### FR-005 ? Planning and simulation

The planner emits typed candidate `ActionPlan` objects. The selected plan must pass deterministic policy checks and a browser simulation before execution.

### FR-006 ? One-step execution

Only one reversible action executes before a fresh observation and verification. Batch writes and hidden side effects are forbidden.

### FR-007 ? Verification and recovery

An independent verifier compares expected and observed postconditions. A mismatch triggers evidence-based replanning, limited to three attempts. Exhaustion stops safely.

### FR-008 ? Consent

Irreversible actions require a separate, accessible confirmation that states the exact action, price, date, and consequences. Consent is scoped to one action and expires when state changes.

### FR-009 ? Observatory

The interface streams state transitions, concise agent summaries, tool events, evidence, rejected constraints, latency, and confidence. It must not display private chain-of-thought.

### FR-010 ? Adapter learning

A successful verified run may create a redacted `InteractionTrace`. Adapter publication requires automated tests and an artifact hash. Raw screenshots and personal data are excluded by default.

## 6. Non-functional requirements

- The core demo starts locally with one documented command.
- Live and replay modes are visibly labelled.
- A network or model failure never converts into an unverified success.
- Zero unconsented irreversible actions are permitted in the evaluation suite.
- Every model-produced object is schema-validated.
- The product itself passes keyboard, screen-reader semantics, contrast, reduced-motion, and focus-order checks.
- Sensitive data never enters logs, URLs, analytics, or adapter artifacts.
- The demo remains usable at 200% zoom and at 360 CSS pixels wide.

## 7. Explicit non-goals for Build Week

- claiming universal website compatibility
- remediating source code or certifying WCAG conformance
- real purchases, real payment credentials, or live passenger data
- native mobile or augmented-reality clients
- general autonomous browsing
- healthcare, legal, employment, or financial decision-making
- production federation, billing, or marketplace distribution
- arbitrary runtime code generation in the user's browser

## 8. Success metrics

The minimum evaluation matrix is 30 combinations across layout variants, profiles, and task constraints.

- task completion: at least 90% on the deterministic fixture set
- constraint satisfaction: 100% on completed runs
- unconsented irreversible actions: exactly 0
- stale-state detection: 100% on injected mutation cases
- recovery: at least 80% of recoverable injected mismatches
- adaptive surface accessibility: zero automated critical violations
- judge setup: clean install, build, and start from the README

Metrics are targets to be proven by Phase 9, not claims made in Phase 0.

## 9. Phase gates

- Phase 0: product, architecture, safety, demo, and decision contracts frozen
- Phase 1: executable repository topology and health checks
- Phase 2: closed schemas, database migrations, and deterministic state machine
- Phase 3: randomized demo portal and complete visual shell
- Phase 4: GPT-5.6 Sol runtime integration
- Phase 5: browser execution and verification loop
- Phase 6: adaptive compiler and accessibility modalities
- Phase 7: Codex Adapter Forge
- Phase 8: Agent Observatory and visual choreography
- Phase 9: evals, red teaming, and hardening
- Phase 10: submission packaging and deployment

## 10. Change control

Changing the track, primary scenario, three access profiles, consent boundary, maximum replan count, or user-side assistive positioning requires a new entry in `docs/decisions.md` and an explicit user decision. Feature additions must not displace the verified end-to-end demo path.
