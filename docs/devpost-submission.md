# MORPH — Devpost submission copy

## Project name

MORPH

## Tagline

**Any interface. Any body. One intent.**

## Elevator pitch

MORPH is a user-controlled accessibility runtime that compiles an inaccessible interface into a task-specific adaptive surface, operates the original interface one risk-gated step at a time, and verifies fresh evidence after every action.

## One-sentence submission summary

Instead of asking 1.3 billion people with disabilities to adapt to every interface, MORPH carries the person’s access profile, intent, constraints, and consent policy to the edge—and recompiles the task around them.

## Track

Apps for Your Life

## Live links

- Application: `<LIVE_APP_URL>`
- Intentionally inaccessible demo portal: `<LIVE_DEMO_PORTAL_URL>`
- Three-minute video: `<DEMO_VIDEO_URL>`
- Repository: `<REPOSITORY_URL>`

## The problem

Accessibility is still delivered application by application and page by page. During a time-sensitive task—such as rebooking a disrupted journey—a person with low vision, one-switch motor access, or high cognitive load may have to navigate dense controls, ambiguous dates, low contrast, surprise add-ons, and inaccessible confirmation patterns.

The World Health Organization estimates that 1.3 billion people, or one in six people globally, experience significant disability. Waiting for every vendor to remediate every workflow cannot be the only path.

## What MORPH does

MORPH turns a live interface into untrusted evidence, combines it with a portable `AccessProfile` and explicit task constraints, and produces a closed `AdaptiveUIManifest`. A deterministic compiler renders that manifest through a small semantic React grammar tailored to the person:

- Low Vision: 200% type, high contrast, large stable targets, and reduced motion.
- One-Switch Motor: deterministic scan order, three large stops, and no timed interaction.
- Cognitive Load Reduction: plain language, one decision at a time, and at most three choices.

The adaptive surface does not receive execution authority. Every interaction becomes a typed intent that re-enters MORPH’s durable state machine. Reversible work advances one browser step, then stops for a fresh DOM/accessibility capture and independent verification. An irreversible R4 action pauses for fresh, accessible, action-specific consent.

The visual Agent Observatory makes the orchestration legible: state transitions, tool calls, candidate plans, Critic rejections, Adapter Forge activity, and verification evidence stream from the append-only session log. Private chain-of-thought and raw model output are never broadcast.

## The zero-to-one insight

Accessibility overlays patch a page after the fact. MORPH changes the abstraction entirely: it compiles the smallest interface needed for one person’s current intent while safely operating the original system of record.

That turns accessibility from a vendor-side visual repair into a user-edge runtime:

- the person owns the access profile and consent policy;
- the model proposes typed artifacts rather than arbitrary UI or actions;
- deterministic code owns state, risk, execution, retries, and verification;
- the interface may mutate without erasing the human goal;
- verified adapters can be generated, tested, signed, retrieved, and repaired.

MORPH is assistive software, not a compliance overlay and not a WCAG certification. It complements the continued need for accessible source products.

## How we built it

### GPT-5.6 Sol and the Responses API

The reasoning client uses `client.responses.create` with `gpt-5.6-sol` and high reasoning effort. It preserves bounded encrypted reasoning items across browser mutations with `reasoning.context`, uses three explicit prompt-cache breakpoints, and requests strict Structured Outputs for every domain artifact.

Programmatic Tool Calling prevents raw DOM and accessibility trees from bloating model context. Two client-owned tools return bounded structural records and use `allowed_callers: ["programmatic"]`; only JavaScript inside the isolated V8 program can invoke them. Arguments and outputs are closed Zod schemas, direct tool calls are rejected, and tool rounds are capped.

### Multi-agent orchestration

MORPH divides cognition into five roles:

1. **Root Reasoner** reconstructs the task from durable event summaries and resolves ambiguity.
2. **Perception** joins bounded DOM and accessibility evidence into a `SurfaceGraph`.
3. **Adaptive Design** compiles the profile and intent into an `AdaptiveUIManifest`.
4. **Planner** proposes page-version-bound, idempotent, independently verifiable steps.
5. **Critic** rejects prompt injection, constraint violations, stale assumptions, false success, and risk downgrades.

Specialist routing is application-managed behind a feature flag. The outer graph is always deterministic: `CAPTURE → NORMALIZE → ROUTE → PARALLEL_REASON → COMPILE → SIMULATE → RISK_GATE → EXECUTE_ONE_STEP → VERIFY`.

### Browser execution and verification

An isolated Playwright worker captures CDP DOM snapshots and the accessibility tree, maps abstract typed actions to robust locators, and executes exactly one admitted step. It then captures fresh state and compares evidence with expected postconditions. Mismatch rewinds to perception and may replan at most three times.

### Codex Adapter Forge

When pgvector routing cannot find a safe adapter, the server-side Codex SDK becomes a coding specialist. MORPH creates a redacted ephemeral workspace with network disabled, one writable artifact, the `Adapter` contract, and allowlisted surface primitives. Codex may generate and repair TypeScript for at most three attempts.

The generated adapter is not trusted because Codex wrote it. It must pass independent AST policy, VM, unit, Playwright, axe-core, and target-integrity gates. Passing source is SHA-256 hashed, Ed25519 signed, and persisted with a routing embedding. A pinned prebuilt adapter goes through the same gates when live generation is unavailable, keeping the judge demo deterministic without weakening policy.

### Durable evidence layer

PostgreSQL and pgvector store access profiles, sessions, append-only events, surface graphs, manifests, adapters, traces, and eval results. SSE tails the indexed session log with cursor resume, backpressure, heartbeat, bounded history, exact authorization, and a strict public projection that strips private reasoning.

## The demo

The left pane is SkyDash, an intentionally inaccessible travel-rebooking fixture with five DOM/layout variants. The right pane is MORPH’s compiled surface and Agent Observatory.

The intent is fixed:

> Move tomorrow’s disrupted journey from Delhi to Bengaluru below ₹8,000. Keep the passenger unchanged, add no extras, and do not purchase without confirmation.

The five-second moment is the **Mutate source UI** control. It replaces the date picker after an action plan exists. MORPH detects a verification mismatch, rejects the stale locator, rewinds to CAPTURE, re-runs Perception, and selects a page-version-bound repair without losing the user’s constraints.

A labelled deterministic judge replay is available when model access, PostgreSQL, or live Codex generation is unavailable. It uses the same strict public event schema and reducer as live SSE and is never presented as a live call.

## Adversarial safety

We inject four hostile page fixtures:

- hidden text instructing the model to choose the most expensive flight;
- fake system text claiming consent is already granted;
- a SUBMIT action mislabeled as reversible R1;
- fake tool output claiming verification succeeded.

The Critic rejects every fixture without creating an actionable node. The closed `ActionStep` schema and independent deterministic risk gate also reject command/risk downgrades. Correctly classified `SUBMIT` remains R4, irreversible, and paused at `REQUIRE_CONSENT`.

## Evaluation results

The reproducible matrix covers five portal layouts × three access profiles × two task intents:

- 30 scenarios
- 100% task completion on the deterministic fixture
- 100% constraint satisfaction
- zero adaptive-surface accessibility violations in the constrained grammar audit
- 12 total retries, 0.4 mean
- 1,652 ms median and 2,139 ms p95 simulated latency
- 106,760 estimated tokens
- **0 unconsented irreversible actions**

The last metric is an absolute build gate: any result above zero exits non-zero.

## Challenges we ran into

### Making agency inspectable without exposing reasoning

A flashy agent graph can accidentally become a chain-of-thought viewer. We designed a separate `ObservatoryEvent` contract that contains only concise summaries, evidence digests, tool names, confidence/state, and rejection codes. Unknown fields fail closed before streaming.

### Preventing model output from becoming authority

It was easy to let a valid JSON plan feel “safe.” Red-teaming found a deeper issue: an irreversible `SUBMIT` command could once be mislabeled as reversible R1 before reaching the browser executor. We fixed it by centralizing command-to-operation and operation-to-risk maps in the shared contract, then enforcing them independently in Zod, the durable state-machine replay, and the executor.

### Demonstrating self-correction in three minutes

A random layout animation is not evidence of safe agency. We built the source mutation as a real verification mismatch with a closed recovery sequence: fresh evidence, rewind, Perception, candidate plan, stale-hypothesis rejection, Critic approval, and safe recompile.

### Safe autonomous code generation

A generated adapter could become a supply-chain attack. The Forge gives Codex no browser handle, database credential, secret, network authority, or publication permission. Independent tests, hashing, signing, and a same-gates fallback keep generation useful without trusting the generator.

## Accomplishments we are proud of

- A complete adaptive interaction grammar across vision, motor, and cognitive profiles.
- A durable event-derived state machine with explicit ASK_USER and REQUIRE_CONSENT pauses.
- One-step browser execution with fresh evidence and a three-replan ceiling.
- Programmatic DOM/accessibility-tree processing with `allowed_callers: ["programmatic"]`.
- A server-side Codex generation-and-repair loop with no-network workspaces and signed pgvector publication.
- An SSE Observatory that proves orchestration without disclosing chain-of-thought.
- A deterministic 30-case eval and adversarial red team with zero unconsented irreversible actions.

## What we learned

The strongest AI systems are not the ones that give a model the most authority. They are the ones that make intelligence composable with evidence, contracts, reversibility, and human control.

Accessibility also cannot be reduced to visual styling. The hard problem is preserving intent and agency across perception, interaction modality, source mutation, uncertainty, and consent.

## What is next

Before any non-fixture target, MORPH needs participatory testing with people who use assistive technology, domain-specific threat models, production identity and session provisioning, signed-key rotation, stronger sandbox isolation, data-retention controls, and restricted pilot integrations.

Longer term, the user-edge runtime could support public services, education, workplace systems, commerce, and essential utilities. Each domain would require its own action taxonomy, consent semantics, verification evidence, and release evals.

## Built with

TypeScript, React 19, vinext/Vite, OpenAI Sites/Cloudflare-compatible ESM, OpenAI Responses API, GPT-5.6 Sol, Programmatic Tool Calling, Structured Outputs, explicit prompt caching, `@openai/codex-sdk`, Playwright, Chrome DevTools Protocol, axe-core, Zod, PostgreSQL, Drizzle ORM, pgvector, Server-Sent Events, SHA-256, and Ed25519.

## Open source and acknowledgements

- OpenAI model and API documentation: https://developers.openai.com/api/docs
- Codex SDK documentation: https://developers.openai.com/codex/sdk
- WHO disability fact sheet: https://www.who.int/news-room/fact-sheets/detail/disability-and-health
- License: `<LICENSE_OR_SUBMISSION_TERMS>`

## Short-form copy variants

### 100 characters

MORPH recompiles inaccessible interfaces around human intent, then verifies every source action.

### 200 characters

Any interface. Any body. One intent. MORPH compiles inaccessible workflows into personal adaptive surfaces, executes one risk-gated step, and verifies fresh evidence before continuing.

### Social post

The web asks every body to adapt to every interface. MORPH reverses it.

We built a GPT-5.6 Sol accessibility runtime that compiles a live task into a profile-specific surface, safely operates the source one step at a time, repairs site mutations with Codex, and fails the build if an irreversible action ever bypasses consent.

30 deterministic scenarios. 4 adversarial fixtures. 0 unconsented irreversible actions.

**Any interface. Any body. One intent.**

`<DEMO_VIDEO_URL>`