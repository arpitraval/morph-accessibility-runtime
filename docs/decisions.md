# MORPH architecture decisions

This file is append-only. Superseded decisions remain visible and link to their replacement.

## ADR-0001 ? Lock Apps for Your Life and MORPH

- Date: 2026-07-14
- Status: Accepted

### Decision

Submit MORPH to the Apps for Your Life track. Freeze travel rebooking as the Build Week vertical and accessibility adaptation as the product thesis.

### Why

The transformation is understandable in seconds, directly demonstrates a coherent consumer experience, and supports a credible population-scale impact case without becoming a chat wrapper.

### Consequences

Workplace automation, education, developer tooling, generic browsing, and additional verticals are excluded until the core travel scenario passes its evaluation contract.

## ADR-0002 ? User-side assistive runtime, not accessibility overlay

- Date: 2026-07-14
- Status: Accepted

### Decision

MORPH creates a user-controlled alternative interaction surface for a task. It does not inject generic remediation into a publisher's page and does not claim that the source becomes WCAG conformant.

### Why

Accessibility is contextual and personal. Compliance claims require publisher ownership, human testing, and broader evidence than a runtime transformation can provide.

### Consequences

Product copy, tests, and demos must consistently describe assistive task completion. The adaptive renderer must itself be accessible.

## ADR-0003 ? Deterministic outer workflow with event-sourced state

- Date: 2026-07-14
- Status: Accepted

### Decision

Use an append-only event store as the future source of truth and a deterministic state machine as the outer orchestrator. Models produce typed proposals inside bounded states.

### Why

Browser side effects, consent, retries, and recovery require replayable state, idempotency, and auditable transitions that model memory cannot guarantee.

### Consequences

Phase 2 must define event versions, idempotency keys, transition guards, and closed schemas before live model or browser integration.

## ADR-0004 ? Preserve the Sites-compatible web package at repository root

- Date: 2026-07-14
- Status: Accepted

### Decision

Keep `@morph/web`, `app/`, `.openai/hosting.json`, and the vinext worker at the repository root. Add executable services under `apps/` and shared libraries under `packages/` using npm workspaces.

### Why

This preserves the bundled OpenAI Sites and Cloudflare-compatible build contract while still providing a monorepo boundary for the agentic runtime.

### Consequences

The repository differs from the conceptual `apps/web` layout. Documentation and commands must treat the root package as the web workspace. Sites D1 and R2 remain null.

## ADR-0005 ? GPT-5.6 Sol is the critical reasoner; authority remains in code

- Date: 2026-07-14
- Status: Accepted

### Decision

Use `gpt-5.6-sol` for multimodal perception, intent reasoning, adaptive design, candidate planning, criticism, and verification. Use deterministic code for state, policy, consent, risk gates, idempotency, and side-effect authorization.

### Why

Sol's reasoning, image input, structured output, persisted reasoning, Programmatic Tool Calling, and Multi-agent features create the product capability. Safety-critical authority must still be testable and deterministic.

### Consequences

All model artifacts require schema validation. Multi-agent beta must have a labelled deterministic replay path and may not control shared mutable state directly.

## ADR-0006 ? Codex Adapter Forge is sandboxed and test-gated

- Date: 2026-07-14
- Status: Accepted

### Decision

Use the Codex SDK in Phase 7 to generate or repair target adapters only inside an ephemeral restricted workspace. Publish only signed artifacts that pass automated tests.

### Why

This makes Codex a genuine product specialist while preventing generated code from inheriting runtime authority.

### Consequences

Adapters can propose typed observations and actions but cannot bypass the outer state machine or consent governor.

## ADR-0007 ? PostgreSQL and pgvector are the planned authoritative store

- Date: 2026-07-14
- Status: Accepted

### Decision

Phase 2 will target PostgreSQL with pgvector for event state and adapter retrieval. Do not enable Sites D1 merely because it exists in the starter.

### Why

The frozen architecture requires transactional event append, vector retrieval, and relational audit queries. A second store would add ambiguity before the core path is proven.

### Consequences

D1 and R2 remain null in `.openai/hosting.json`. Any deployment-specific cache requires a later ADR.

## ADR-0008 ? Phase 1 stops at a local scaffold checkpoint

- Date: 2026-07-14
- Status: Accepted

### Decision

Do not create or publish a Sites project during Phase 1. Validate the local scaffold and return the tree and ledger before Phase 2.

### Why

The user requested an explicit structural verification checkpoint, and the product web experience is not yet complete.

### Consequences

Hosting is deferred to the submission packaging phase after a successful full build and user-visible product validation.

## ADR-0009 - Zod schemas are the canonical process boundary

- Date: 2026-07-14
- Status: Accepted

### Decision

Define every cross-process Phase 2 artifact as a strict Zod schema and derive its exported TypeScript type from that schema. Reject unknown keys at ingress.

### Why

Independent handwritten runtime schemas and compile-time types drift. A single executable schema source ensures that model, browser, database, and replay inputs share the same closed contract.

### Consequences

Action steps cannot omit risk class or reversibility. R4 steps are irreversible and consent-gated, RX steps are denied, selected plans require a passed simulation, and invalid model objects never reach durable state.

## ADR-0010 - Workflow state is a replayed projection, not a stored field

- Date: 2026-07-14
- Status: Accepted

### Decision

Store immutable, versioned AgentEvent envelopes in a per-session sequence. Reconstruct current state, pause state, retry count, and terminal state by replaying that sequence on every decision.

### Why

A mutable current-state column can disagree with the audit log after retries or partial failures. Pure replay makes transitions deterministic, testable, and recoverable after process loss.

### Consequences

The state machine rejects gaps, duplicate event ids, duplicate idempotency keys, cross-session batches, forward causation references, illegal edges, and transitions after terminal state. A verification mismatch can enter CAPTURE three times; the next mismatch enters STOP_SAFE.

## ADR-0011 - PostgreSQL event log and pgvector adapter routing layout

- Date: 2026-07-14
- Status: Accepted

### Decision

Use eight relational tables for Phase 2: access profiles, sessions, session events, surface graphs, UI manifests, adapters, interaction traces, and evaluation results. Store typed artifacts as JSONB beside indexed routing/audit columns. Use a 1536-dimension pgvector embedding and cosine HNSW index for adapters.

### Why

MORPH needs exact relational constraints for authorization and audit, full typed artifacts for replay, and approximate semantic retrieval for adapter candidates. Retrieval remains advisory and cannot authorize execution.

### Consequences

The initial migration enables pgvector, creates explicit session/access-profile indexes, enforces per-session event sequence and idempotency uniqueness, and installs a trigger that rejects UPDATE or DELETE on session_events. Changing embedding dimensions requires a new migration and ADR.

## ADR-0012 - Isolate the adversarial demo world as a separate application

- Date: 2026-07-14
- Status: Accepted

### Decision

Run the intentionally inaccessible SkyDash portal as `@morph/demo-portal`, a separate Vite/React application on port 4173. Embed it in the MORPH web shell through an iframe and expose exactly five layout variants through `?variant=0` to `?variant=4`; query-free reloads rotate the variant within the browser session.

### Why

A separate application creates a real styling, DOM, and runtime boundary between the hostile source and the adaptive product. Deterministic variants demonstrate layout drift without making a three-minute demo dependent on randomness.

### Consequences

Inaccessible patterns are confined to `apps/demo-portal`. The accessibility kit cannot inherit portal CSS, and Phase 3 does not claim same-origin DOM inspection. A later authorized browser worker must capture the source through its typed evidence boundary.

## ADR-0013 - Phase 3 UI is a contract-validated replay, not simulated agency

- Date: 2026-07-14
- Status: Accepted

### Decision

Validate all three profile fixtures with `AdaptiveUIManifestSchema` at module initialization and label the observatory as a deterministic replay. Do not initialize the OpenAI SDK, execute browser actions, or imply that fixture evidence came from a live model.

### Why

The visual shell must be complete before model integration, while preserving the Phase 2 closed-contract boundary. Schema parsing makes visual fixtures representative of executable payloads instead of one-off presentation objects.

### Consequences

Low Vision, One-Switch Motor, and Cognitive Load Reduction share one semantic component renderer but receive visibly distinct presentation grammars. Invalid manifest changes fail the application build immediately.

## ADR-0014 - The primary demo composition is evidence-first split screen

- Date: 2026-07-14
- Status: Accepted

### Decision

Use a persistent two-pane comparison: hostile source on the left, MORPH adaptive runtime on the right. Keep the profile switcher and adaptive surface above the fold, place the constraint ledger beside the adaptive controls, and compress the full event lifecycle into a five-stage evidence rail: Capture -> Reason -> Compile -> Simulate -> Verify.

### Why

The first five seconds must communicate before/after value, while the rest of the frame proves that adaptation is constrained, inspectable, and consent-aware.

### Consequences

The observatory is an evidence view over bounded fixture agents, not a decorative chat transcript. The purchase gate remains visible in every profile, and source mutation visibly invalidates stale assumptions.

## ADR-0015 - Use the stable Responses API with stateless reasoning continuity

- Date: 2026-07-14
- Status: Accepted

### Decision

Target `gpt-5.6-sol` through `client.responses.create` with `reasoning.effort: high`. Set `store: false`, request encrypted reasoning content, and replay bounded opaque output items between calls. Select `reasoning.context: current_turn` for a fresh task and `all_turns` when continuing after browser mutations.

### Why

MORPH needs reasoning continuity without converting provider-side conversation state into workflow authority. Replaying opaque Responses items preserves model context while the append-only `session_events` log remains the sole durable source of execution truth.

### Consequences

Reasoning continuation is capped at 200 items and is never interpreted as application state. The model id is fixed in code, the legacy Chat Completions endpoint is forbidden, and a non-completed response or exhausted eight-round tool loop fails closed.

## ADR-0016 - Enforce two independent structured-output gates

- Date: 2026-07-14
- Status: Accepted

### Decision

Supply the Phase 2 contracts as strict Responses JSON Schema formats through `text.format`, then JSON-decode and locally parse the returned artifact with the matching Zod schema. Check each requested output kind against its legal state-machine states before making a request.

### Why

The current Responses API exposes Structured Outputs through `text.format`; `response_format` is the Chat Completions spelling. Service-side schema generation reduces malformed responses, while the independent local parse prevents unvalidated strings or provider drift from entering MORPH state.

### Consequences

SurfaceGraph, IntentGraph, AdaptiveUIManifest, ActionPlan, and VerificationResult are the only admitted model artifacts. Unknown fields fail locally. The adapter to `MachineSignal` exposes only closed transition signals, including explicit ambiguity and verification outcomes.

## ADR-0017 - Keep large surface evidence behind the programmatic caller boundary

- Date: 2026-07-14
- Status: Accepted

### Decision

Expose only `read_surface_records` and `query_surface_records`, both with strict input and output schemas, immutable snapshot identifiers, page versions, hard result limits, and `allowed_callers: ["programmatic"]`. Also enable the `programmatic_tool_calling` tool. Reject direct model calls to these client functions.

### Why

The official Programmatic Tool Calling caller value is `programmatic`; `code_execution_20260120` is not part of the current Responses schema. Compact normalized records let the isolated V8 program filter and join large DOM and accessibility-tree captures without flooding the model context or granting raw page access.

### Consequences

Raw HTML, screenshots, network access, filesystem access, and secrets do not cross the agent tool boundary. The client validates both call arguments and runtime results, preserves program caller identity on tool output, and rejects unknown or non-programmatic calls.

## ADR-0018 - Manage specialist routing at the application layer behind a default-off flag

- Date: 2026-07-14
- Status: Accepted

### Decision

Route SurfaceGraph to PERCEPTION, AdaptiveUIManifest to ADAPTIVE_DESIGN, ActionPlan to PLANNER, and VerificationResult to CRITIC when `MORPH_MULTI_AGENT_ENABLED=true`; keep IntentGraph with ROOT. With the flag off, ROOT handles the same requests sequentially. With it on, a routed batch may run specialists concurrently through the stable Responses endpoint.

### Why

Application-managed routing keeps the production contract on the explicitly requested `client.responses.create` endpoint and makes concurrency deterministic and testable. It does not silently opt into the separate beta multi-agent API.

### Consequences

All five prompts share one version identifier and safety constitution. Specialist mode changes role selection and concurrency only; it does not weaken output schemas, tool restrictions, or state compatibility checks.

## ADR-0019 - Place three explicit cache breakpoints on stable agent prefixes

- Date: 2026-07-14
- Status: Accepted

### Decision

Create stable developer-message cache boundaries for the versioned role and safety constitution, the closed AccessProfile JSON Schema, and the adaptive UI grammar. Use an explicit 30-minute cache policy and a versioned cache key scoped by role and output kind.

### Why

These blocks are large, stable across repeated steps, and security-sensitive. Explicit breakpoints maximize reusable prompt prefixes without mixing role-specific tasks or dynamic untrusted evidence into the cached material.

### Consequences

Cache effectiveness remains dependent on provider minimum-token and prefix-match rules. Dynamic access-profile instances, page evidence, and user task data appear after the stable cache blocks and are never assumed to be cached.

## ADR-0020 - Isolate browser execution in a persistent, origin-bounded Chromium context

- Date: 2026-07-14
- Status: Accepted

### Decision

Run browser work inside the dedicated `@morph/browser-worker` application using Playwright 1.61.1 and a private persistent Chromium profile. Keep Chromium headless with a fixed viewport, downloads disabled, service workers blocked, no granted permissions, HTTPS errors enforced, and an explicit origin allowlist. Do not disable Chromium's process sandbox.

### Why

MORPH must preserve a real browser session without sharing the user's daily browser profile or permitting arbitrary network navigation. A separate worker service and private browser profile create a clear authority boundary around hostile page data and physical actions.

### Consequences

Only explicitly allowed origins may load. Cookies are cleared when a worker launches, while the isolated profile supports same-worker session continuity. Browser lifecycle, artifacts, and target pages are owned by the worker; the web application and model client never receive a Playwright Page or BrowserContext.

## ADR-0021 - Capture DOM and accessibility evidence through CDP into bounded snapshots

- Date: 2026-07-14
- Status: Accepted

### Decision

Capture `DOMSnapshot.captureSnapshot` and `Accessibility.getFullAXTree` through a page-scoped CDP session, plus a fresh Playwright PNG screenshot. Normalize both trees into the Phase 4 `SurfaceToolRuntime` records, paginate tool responses to their 500-record contract limit, retain at most eight immutable in-memory snapshots, and label every raw artifact `UNTRUSTED_PAGE_DATA`.

### Why

Programmatic tools need large, structured surface evidence without placing raw HTML or screenshots in model context. Immutable snapshot ids, page versions, hashes, evidence ids, and hard pagination limits make every read attributable and bounded.

### Consequences

Raw screenshot bytes and CDP payloads are ephemeral verification artifacts and are not persisted by default. A worker restart invalidates its in-memory locator hints and forces a fresh capture and replan. The append-only session event log remains workflow authority; the snapshot cache is evidence, not state.

## ADR-0022 - Enforce a closed command-to-risk matrix before locator resolution

- Date: 2026-07-14
- Status: Accepted

### Decision

Classify OBSERVE, FOCUS, and NAVIGATE as read operations (R0/R1); EXPAND, SELECT, INPUT_TEXT, ADD_OPTION, and REMOVE_OPTION as reversible writes (R2/R3); and SUBMIT as irreversible (R4). Reject RX and DENY unconditionally. Require passed simulation, exact page-version equality, durable `EXECUTE_ONE_STEP` state, and single-flight execution for every command.

For R4, additionally require replay-derived proof that the workflow crossed REQUIRE_CONSENT and a granted, unexpired ConsentRecord matching session, action step, page version, and SHA-256 of the exact closed ActionStep.

### Why

A command name alone cannot grant browser authority. Cross-checking operation class, risk class, reversibility, execution policy, durable state, simulation, page version, and exact consent prevents stale or downgraded plans from bypassing the safety governor.

### Consequences

Generic SUBMIT is conservatively irreversible even when a particular website might use it for a read-only search. A future adapter may introduce a narrower closed command only through a contract change and ADR; it may not weaken SUBMIT at runtime.

## ADR-0023 - Resolve targets deterministically and stop on ambiguity

- Date: 2026-07-14
- Status: Accepted

### Decision

Resolve each `targetNodeId` through hints captured with its active snapshot. Try a full structural CSS path, then a small allowlist of role/name locators, then exact visible text. A candidate is usable only when it matches exactly one visible element. Track main-document navigation epochs and reject hints from a stale document or page version.

### Why

Layout variants and React mutations make one brittle selector insufficient, while arbitrary `.first()` or nth-element fallbacks can activate the wrong fare or irreversible control. Multiple semantic strategies are safe only when uniqueness remains provable.

### Consequences

Ambiguous or missing targets raise `TargetResolutionError` before mutation. Raw page-provided role strings are not cast into Playwright locators unless they belong to the explicit role allowlist, and diagnostic errors expose only strategy classes and counts.

## ADR-0024 - Verify only fresh evidence with deterministic predicates

- Date: 2026-07-14
- Status: Accepted

### Decision

Require a newly incremented page version after every executed step and evaluate postconditions over the resulting screenshot, normalized DOM, and accessibility tree. Support a closed deterministic grammar: `VISIBLE_TEXT:`, `ABSENT_VISIBLE_TEXT:`, `URL_EQUALS:`, `TITLE_EQUALS:`, and `NO_VISIBLE_DIALOG`. Unsupported natural-language conditions produce INCONCLUSIVE rather than guesses.

### Why

Reusing pre-action evidence or interpreting unconstrained prose would allow false success. A small explicit predicate grammar makes mismatch behavior testable and preserves an escalation path to an independent verifier without granting it execution authority.

### Consequences

The verifier emits a closed VerificationResult and a direct MachineSignal adapter. MATCH advances, MISMATCH enters the existing three-replan loop, and INCONCLUSIVE pauses through ASK_USER. Hidden fees and unexpected dialogs are first-class negative postconditions.
## ADR-0025 - Constrain adaptive rendering to a semantic component grammar

- Date: 2026-07-14
- Status: Accepted

### Decision

Expose AdaptiveButton, AdaptiveList, AdaptiveModal, and AdaptiveText as the only Phase 6 rendering primitives. Use native button, list, heading, status, dialog, and alertdialog semantics; require explicit button labels; keep modal focus inside the dialog; and encode visual variants only through fixed class names and enumerated data attributes.

### Why

A model-authored style or arbitrary React tree would recreate the unpredictability MORPH is supposed to remove. A small semantic grammar makes focus, contrast, typography, target size, screen-reader output, and test behavior deterministic.

### Consequences

Adaptive manifests cannot inject CSS, event source, HTML, or arbitrary components. High contrast, base/large/x-large type, reduced motion, and focus-visible behavior come from the kit's fixed stylesheet. The demo portal keeps a separate hostile visual language and cannot share these primitives.

## ADR-0026 - Compile only complete, reachable manifest graphs

- Date: 2026-07-14
- Status: Accepted

### Decision

Parse AdaptiveUIManifest and AccessProfile again at the renderer boundary, require matching profile identifiers, and compile only graphs whose roots exactly match parentless nodes. Only GROUP nodes may own children; every node must be reachable; cycles, duplicate focus entries, orphan parents, missing action-step bindings, and non-action focus targets fail closed.

### Why

A structurally valid flat Zod object may still describe an ambiguous or unreachable UI graph. Deterministic recursive compilation needs stronger graph invariants than field-level validation alone.

### Consequences

Sibling order is stable by order then id. HEADING, TEXT, STATUS, FIELD, SUMMARY, GROUP, ACTION, CHOICE, and CONSENT map to fixed grammar components. A rejected manifest renders an accessible compiler error and dispatches no action.

## ADR-0027 - Route adaptive actions through a closed risk-gated intent

- Date: 2026-07-14
- Status: Accepted

### Decision

Represent every adaptive selection as a strict AdaptiveExecutionIntent bound to session, manifest version, AccessProfile, component, source nodes, and ActionStep. Pin its entry state to RISK_GATE, requested state to EXECUTE_ONE_STEP, and target to BROWSER_WORKER. The state machine reparses the intent and ActionStep, verifies their binding against the append-only session stream, and invokes its existing ACTION_READY risk decision.

### Why

A React click is user intent, not browser authority. The compiler must not call Playwright or manufacture an execution state. Binding the UI event to the durable risk gate preserves consent, simulation, page-version, and one-step execution requirements.

### Consequences

A reversible validated step may transition from RISK_GATE to EXECUTE_ONE_STEP. An irreversible or consent-required step still transitions to REQUIRE_CONSENT. The UI's idempotency key is deterministic per session, manifest version, and action step; transport and durable append remain orchestrator responsibilities.

## ADR-0028 - Derive presentation and scanning from AccessProfile

- Date: 2026-07-14
- Status: Accepted

### Decision

Derive high-contrast, one-switch, and cognitive-load presentation modes from the validated AccessProfile rather than from ad hoc UI flags. Derive font scale from text scale and zoom. In one-switch mode, autofocus the first manifest focus target, use the manifest focus order as a roving tab sequence, advance at the profile's scan interval, and support arrow-key traversal. In cognitive-load mode, enforce plain typography, aggressive spacing, step-at-a-time metadata, and the profile's maximum enabled choice count.

### Why

Profile labels are presentation hints; the closed profile fields are the actual user contract. One deterministic derivation prevents the shell and compiled controls from disagreeing.

### Consequences

Switch scanning never changes business ordering or bypasses disabled state. Native Enter and Space activate only the focused button. Reduced-motion profiles suppress animation, and profile changes remount/recompile the surface from the same validated intent.

## ADR-0029 - Give Codex a disposable build root, not runtime authority

- Date: 2026-07-14
- Status: Accepted

### Decision

Start one server-side Codex SDK thread per unknown surface inside a newly created private workspace containing only a redacted DOM fixture, bounded surface records, the pure Adapter contract, the read-only SurfaceToolRuntime shape, and an explicit policy file. Run the thread with `workspace-write`, no approvals, no web search, no network access, no additional writable roots, a 30-second turn timeout, and a scrubbed environment. Permit Codex to change only `src/adapter.ts`; hash every trusted input, forbid symlinks and extra files, and destroy the workspace after the attempt sequence.

### Why

Codex is valuable as an adapter author and repair specialist, but page text is adversarial and generated code cannot inherit browser, database, secret, or network authority.

### Consequences

Raw reasoning and agent messages never enter the observability stream. Only thread start, file-change, and turn-complete metadata may be exposed. Production must run Adapter Forge under a dedicated unprivileged service/container boundary in addition to the SDK sandbox.

## ADR-0030 - Admit adapters only through four independent gates

- Date: 2026-07-14
- Status: Accepted

### Decision

Restrict an adapter to one exported pure object literal with no imports, ambient capabilities, dynamic code, mutation, or non-allowlisted method calls. Parse its TypeScript AST, transpile it locally, execute it in a `node:vm` context with string and WebAssembly code generation disabled, validate the projection with Zod, require every target to correspond to a supplied surface record, prove exactly-one visible locator resolution in offline Playwright, and run axe-core against the generated adaptive preview. Feed only bounded, path-scrubbed failures back to the same Codex thread, for at most three total attempts.

### Why

A generated file is untrusted until policy, contract, browser, and accessibility evidence independently agree. Testing inside the generating agent would let the author grade its own work.

### Consequences

Playwright Page and SurfaceToolRuntime never enter generated code. Ambiguous locators, invented nodes, Playwright selector-engine escapes, serious/critical accessibility findings, timeout, or any unknown output fail closed.

## ADR-0031 - Sign verified source and keep the judge fallback inside the same gates

- Date: 2026-07-14
- Status: Accepted

### Decision

Hash the exact verified source with SHA-256, sign the digest with Ed25519, verify the signature again at the persistence boundary, create a 1536-dimensional routing embedding, and transactionally insert source, signature, key id, provenance, validation report, typed Adapter payload, and vector into PostgreSQL. Apply a database statement timeout and verify an idempotent read-back before acknowledging publication.

If live Codex generation times out or exhausts repairs, activate a repository-pinned prebuilt adapter. Re-run the identical policy, VM, Playwright, axe, signing, and persistence gates; never treat fallback provenance as permission to skip validation.

### Why

Content addressing and signatures make later routing auditable. A deterministic fallback protects the three-minute demo from model latency while preserving the same safety contract.

### Consequences

The UI may display the strict `ADAPTER_FORGE_ACTIVE` event and bounded gate progress, but not source code or chain-of-thought. If both live and prebuilt paths fail, MORPH emits `ADAPTER_FORGE_STOPPED_SAFE` and publishes nothing.

## ADR-0032 - Project durable events into a closed Observatory contract

- Date: 2026-07-15
- Status: Accepted

### Decision

Record specialist activity, candidate plans, Critic rejections, verification evidence, and Adapter Forge status as strict AgentEvent variants in the append-only session log. Expose them through a separate strict ObservatoryEvent union. The stream projector constructs every public field explicitly and never spreads a database payload.

Verification evidence may contain bounded summaries and SHA-256 digests, but raw screenshots are excluded. Every public event carries literal redaction proof that reasoning and raw model output were excluded. A durable event with any unknown field, including encrypted reasoning, fails closed before serialization.

### Why

The Observatory must prove orchestration without turning private reasoning or hostile page data into a broadcast channel. A second allowlisted schema makes the disclosure boundary independently testable and keeps PostgreSQL, rather than an in-memory UI feed, authoritative.

### Consequences

Adapter Forge status now shares the same contract package as the durable log. Non-observability events advance the SSE cursor without being broadcast. Invalid stored payloads terminate the affected stream safely and never echo validation detail or raw content to the browser.

## ADR-0033 - Tail the indexed event log with bounded resumable SSE

- Date: 2026-07-15
- Status: Accepted

### Decision

Serve text/event-stream from the orchestrator with sequence as the SSE id. Resume from Last-Event-ID or a validated after cursor, read at most 100 ordered rows per query, poll at 250 ms after catch-up, and send heartbeat comments every 15 seconds. Pause production under stream backpressure, cap browser history at 120 validated events, and abort polling, timers, readers, and PostgreSQL resources when either side closes.

Require an injected session authorizer before the first database read. The executable demo server binds one explicit demo session to a constant-time compared credentialed cookie, uses an exact CORS origin, keeps query statements under a five-second timeout, and never accepts credentials in the URL.

### Why

Indexed catch-up polling is deterministic, reconnect-safe, and does not allocate one PostgreSQL LISTEN connection per browser. It uses the existing (session_id, sequence) index and works behind ordinary reverse proxies while keeping connection lifetime bounded.

### Consequences

SSE is an evidence projection, not workflow state. Native EventSource reconnects preserve the last accepted id; duplicate ids are removed client-side. Deployment must set DATABASE_URL, MORPH_DEMO_SESSION_ID, MORPH_WEB_ORIGIN, and a 32-character-or-longer MORPH_STREAM_AUTH_TOKEN.

## ADR-0034 - Demonstrate source drift through the real retry boundary

- Date: 2026-07-15
- Status: Accepted

### Decision

Make the demo mutation physically replace the source calendar with an incompatible free-text date control. In live mode, an authenticated POST acquires the session row lock, replays the durable log, requires the current state to be VERIFY with retry capacity, and transactionally appends verification evidence, VERIFICATION_MISMATCH, VERIFY-to-CAPTURE rewind, fresh Perception activity, parallel Planner/Critic work, a selected candidate, a rejected stale-locator hypothesis, and the safe COMPILE transition.

Keep a deterministic replay path for the three-minute judge demo, but label it Labeled judge replay in the UI and feed it through the exact ObservatoryEvent schema and reducer used by SSE. It may demonstrate presentation when PostgreSQL is unavailable; it never claims to be live durable state.

### Why

A visual layout shuffle alone does not prove safe agency. Showing the failed postcondition, rewind, recapture, and evidence-bound repair demonstrates the central MORPH invariant in seconds and preserves a non-hanging fallback for the video.

### Consequences

The live endpoint is idempotent per mutation UUID and refuses unknown fields, unknown sessions, non-VERIFY states, or exhausted retries. The React button cannot inject state transitions directly in live mode; it only requests the orchestrator mutation scenario.
## ADR-0035 - Make the Phase 9 safety matrix reproducible and fatal

- Date: 2026-07-15
- Status: Accepted

### Decision

Evaluate the exact Cartesian product of five TravelPortal layouts, three validated AccessProfiles, and two task intents under a frozen seed and timestamp. Derive the irreversible boundary through the production ActionStep schema and deterministic state-machine RISK_GATE, emit per-case constraint, accessibility, retry, simulated-latency, and token-estimate evidence, and hash the canonical report. Run this evaluator before tests in the root check command. Any unconsented irreversible action above zero throws an EvaluationSafetyError and exits non-zero.

### Why

A repeatable 30-case matrix makes safety regressions reviewable and prevents a favorable live demo from substituting for coverage. Consent is a release invariant, not an average metric.

### Consequences

Latency and token price are explicitly labelled deterministic estimates, not provider telemetry. The adaptive accessibility metric validates the constrained profile grammar; the intentionally inaccessible source violation count remains a separate baseline. Real Playwright and axe evidence remains mandatory in CI.

## ADR-0036 - Centralize command-to-risk classification before execution

- Date: 2026-07-15
- Status: Accepted

### Decision

Define one closed ActionCommand-to-operation-class map and one allowed-risk map in @morph/contracts. Enforce them in the ActionStep Zod schema, re-check them at the stateless state-machine RISK_GATE, and consume the same map in the browser executor. SUBMIT is always irreversible and R4; reversible writes are R2 or R3; read operations are R0 or R1. RX remains a representable, denied plan state.

### Why

Red-teaming found that the old schema could label a SUBMIT command as reversible R1. The browser executor would eventually reject it, but the RISK_GATE could wrongly admit it first. Independent enforcement at construction, orchestration, and execution prevents both model error and boundary drift.

### Consequences

A command-risk downgrade fails schema validation and, if a malformed signal somehow reaches replay, deterministically transitions to STOP_SAFE/FATAL_ERROR. A correctly classified R4 command still transitions only to REQUIRE_CONSENT with a page-version-bound hook.

## ADR-0037 - Keep real browser gates in Linux CI and classify local EPERM honestly

- Date: 2026-07-15
- Status: Accepted

### Decision

Use GitHub Actions ubuntu-latest with Node 24, npm ci, a real Playwright Chromium install, the complete npm run check gate, and a production dependency audit. Do not add a browser mock, skip flag, or conditional success path to CI. Document the Codex-managed Windows spawn EPERM boundary separately: lint, typecheck, eval, and in-process unit/red-team tests remain mandatory locally, while exact spawn EPERM browser/Vite failures are environment-blocked rather than passing.

### Why

Mocking Chromium would erase the security and accessibility evidence Phase 9 is meant to prove. At the same time, a managed host that forbids child-process creation cannot produce honest browser evidence.

### Consequences

Local validation is not release-green when Chromium or the production bundle is blocked. Merge readiness requires the unchanged GitHub job to pass the real Playwright, axe-core, Vite/vinext, and audit gates.