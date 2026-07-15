# MORPH build ledger

This is the chronological evidence log for the canonical Build Week implementation task. Entries record decisions, commands, failures, recoveries, and verification without storing secrets.

## Entry 0001 ? Phase 0 workspace audit

- Date: 2026-07-14
- Phase: 0
- Status: Complete

### Observed

- Repository existed with only `.git`; the worktree was clean.
- No `AGENTS.md` or existing product files were present.
- No global `node`, `npm`, `pnpm`, `corepack`, or `bun` command was available.
- Git and ripgrep were available.
- No `.openai/hosting.json` existed before initialization.

### Evidence commands

```text
Get-ChildItem -Force
rg --files -g AGENTS.md
git status --short
git rev-parse --show-toplevel
Get-Command node,npm,pnpm,corepack,bun,git,rg
```

### Decision

Treat the workspace as a new project, preserve the existing Git repository, and use the bundled Sites starter because the product includes a deployable web surface.

## Entry 0002 ? Sites starter initialization and runtime recovery

- Date: 2026-07-14
- Phase: 1 prerequisite
- Status: Recovered

### Attempt

Ran the bundled Sites `init-site.sh` against the repository root.

### Failure

The initializer copied the starter source but could not execute its dependency step because `npm` was not on `PATH`. A second initializer run correctly refused to overwrite the now non-empty target.

### Recovery

Located Codex's bundled Node/npm runtime under the desktop application runtime directory. Verified:

```text
node v24.14.0
npm 11.9.0
```

The copied starter was inspected before modification. Dependency installation is recorded after the Phase 1 workspace graph is finalized so the lockfile reflects the real monorepo.

## Entry 0003 ? Phase 0 contract freeze

- Date: 2026-07-14
- Phase: 0
- Status: Complete

### Artifacts

- `AGENTS.md`
- `docs/product-spec.md`
- `docs/architecture.md`
- `docs/demo-contract.md`
- `docs/threat-model.md`
- `docs/decisions.md`
- `docs/build-ledger.md`

### Frozen decisions

- Apps for Your Life track
- MORPH user-side assistive-runtime positioning
- travel rebooking demonstration vertical
- three access-profile presets
- deterministic event-sourced outer workflow
- GPT-5.6 Sol bounded reasoning roles
- explicit accessible consent for irreversible actions
- maximum three evidence-based replans
- PostgreSQL/pgvector planned source of truth
- Codex Adapter Forge sandbox and test gate

### Verification

Contracts were cross-checked for consistent scope, scenario constraints, state transitions, consent language, repository topology, and phase boundaries.

## Entry 0004 ? Phase 1 scaffold design

- Date: 2026-07-14
- Phase: 1
- Status: Complete

### Decision

Preserve the Sites-compatible vinext web package at repository root and add npm workspaces for runtime services and shared libraries.

### Planned executable packages

- `apps/orchestrator`
- `apps/browser-worker`
- `apps/adapter-forge`
- `packages/contracts`
- `packages/agents`
- `packages/state-machine`
- `packages/accessibility-kit`
- `packages/browser-tools`
- `packages/evals`
- `packages/telemetry`

### Phase boundary

Health checks and buildable package seams are implemented in Phase 1. Domain schemas, database migrations, OpenAI calls, browser automation, and adapter generation remain intentionally absent until their designated phases.

## Entry 0005 - Phase 1 executable monorepo scaffold

- Date: 2026-07-14
- Phase: 1
- Status: Complete

### Implemented

- Root Sites-compatible vinext web package with a MORPH-specific, responsive, semantic foundation surface.
- Three executable service workspaces with deterministic health contracts.
- Seven typed shared-library workspaces with frozen Phase 1 descriptors.
- Shared strict TypeScript configuration, npm workspace scripts, environment template, CI workflow, and infrastructure placeholders.
- Root and workspace tests that exercise rendered HTML, package seams, port validation, and service health payloads.

### Dependency graph

- Node: 24.14.0
- npm: 11.9.0
- Root package: `@morph/web`
- Workspace packages: 10
- Lockfile: generated for the complete monorepo

Dependency installation initially failed inside the restricted network sandbox with `ENOTCACHED`. It was retried with approved network access and completed successfully. `npm ls --depth=0` returned exit code 0.

### Corrections made during integration

1. Overrode inherited `rootDir` and `outDir` in each workspace so TypeScript resolves source roots locally.
2. Generalized health configuration inputs from `NodeJS.ProcessEnv` to a readonly string map for deterministic unit tests.
3. Removed unused D1/example starter assumptions because Phase 0 selected PostgreSQL/pgvector as the planned system of record.
4. Replaced ambient Cloudflare-only types with explicit local Phase 1 boundaries.

## Entry 0006 - Phase 1 acceptance evidence

- Date: 2026-07-14
- Phase: 1
- Status: Passed

### Commands

```text
npm run check
npm run health
```

### Results

- ESLint: passed.
- Root TypeScript check: passed.
- Workspace TypeScript checks: 10 of 10 passed.
- Workspace assertions: 13 passed, 0 failed.
- Web assertions: 2 passed, 0 failed.
- vinext production build: passed; root route emitted.
- Service health checks: 3 of 3 returned `status: ready` and `phase: 1`.

The restricted Windows process sandbox blocked Node's isolated test subprocesses with `spawn EPERM`. The identical suite was rerun with approved process access and passed. This was an execution-environment failure; no test assertion failed.

### Health payloads

```json
{"service":"@morph/adapter-forge","status":"ready","phase":1,"port":8792}
{"service":"@morph/browser-worker","status":"ready","phase":1,"port":8790}
{"service":"@morph/orchestrator","status":"ready","phase":1,"port":8788}
```

## Entry 0007 - Phase 1 checkpoint freeze

- Date: 2026-07-14
- Phase: 1
- Status: Complete

### Frozen checkpoint

- Phase 0 contracts are canonical and versioned in-repository.
- The persistent-thread contract in `AGENTS.md` governs subsequent work.
- The monorepo is installable, buildable, typed, tested, and locally executable.
- No Phase 2 state-machine or domain-contract implementation has been smuggled into the scaffold.
- Hosting is intentionally deferred at this user-requested local checkpoint, as recorded in ADR-0008.

### Next authorized phase

Phase 2 may implement the canonical contracts, event envelopes, workflow state machine, validation fixtures, and invariant tests without changing the frozen product/demo contract unless a new ADR explicitly records the deviation.

## Entry 0008 - Phase 2 closed contract implementation

- Date: 2026-07-14
- Phase: 2
- Status: Complete

### Implemented schemas

- AccessProfile
- SurfaceGraph
- IntentGraph
- AdaptiveUIManifest
- ActionPlan
- ActionStep
- VerificationResult
- ConsentRecord
- AgentEvent
- Adapter
- InteractionTrace

Zod 4.4.3 is now an explicit dependency of `@morph/contracts`. Every exported artifact uses a strict runtime schema and a TypeScript type inferred from that schema.

### Safety invariants

- ActionStep requires both `riskClass` and `reversible`.
- R4 actions must be irreversible and use `REQUIRE_CONSENT`.
- RX actions must use `DENY`.
- Reversible R2 actions require compensation commands.
- Selected plans require a passed simulation and cannot contain denied actions.
- Consent is action-scoped and page-version-bound.
- Agent events are strict, versioned, sequenced, correlated, and idempotent envelopes.
- Interaction traces structurally exclude screenshots, personal data, and secrets.

## Entry 0009 - Phase 2 PostgreSQL and pgvector schema

- Date: 2026-07-14
- Phase: 2
- Status: Complete

### Tables

- `access_profiles`
- `sessions`
- `session_events`
- `surface_graphs`
- `ui_manifests`
- `adapters`
- `interaction_traces`
- `eval_results`

### Durable design

The sessions table contains session metadata but no mutable workflow-state field. The authoritative state is the ordered `session_events` stream. Typed JSONB artifacts are stored beside normalized columns used for foreign keys, uniqueness constraints, routing, and audit queries.

The adapters table uses `vector(1536)` and an HNSW cosine index. Similarity retrieval is not an authorization mechanism.

### Migration

`npm run db:generate` produced the initial PostgreSQL migration with 8 tables, 32 indexes, explicit foreign keys, uniqueness constraints, and range/version checks. The migration was hardened to enable pgvector and install a trigger that rejects UPDATE or DELETE on `session_events`.

No live database was mutated because this local checkpoint has no `DATABASE_URL`. Drizzle generation validated the DDL shape; applying it belongs to an authorized environment/deployment step.

## Entry 0010 - Phase 2 deterministic replay state machine

- Date: 2026-07-14
- Phase: 2
- Status: Complete

### Lifecycle

```text
CAPTURE -> NORMALIZE -> ROUTE -> PARALLEL_REASON -> COMPILE
-> SIMULATE -> RISK_GATE -> EXECUTE_ONE_STEP -> VERIFY
```

### Guarantees

- Every decision replays unknown input through AgentEventSchema before deriving state.
- No module-level or process-memory workflow snapshot is authoritative.
- Sequence gaps, duplicate ids, duplicate idempotency keys, mixed sessions, forward causation, illegal edges, and post-terminal transitions are rejected.
- ASK_USER returns an explicit question/ambiguity hook and resumes only after user input.
- REQUIRE_CONSENT returns an action/page-version hook and resumes only after an explicit grant.
- Three verification mismatches may re-enter CAPTURE; the next mismatch enters STOP_SAFE with RETRY_EXHAUSTED.
- One verified step either advances to the next step or completes the session.

## Entry 0011 - Phase 2 acceptance evidence

- Date: 2026-07-14
- Phase: 2
- Status: Passed

### Commands

```text
npm run db:generate
npm run typecheck
npm test --workspace @morph/contracts --workspace @morph/state-machine
npm run check
```

### Results

- Drizzle PostgreSQL generation: passed.
- PostgreSQL tables discovered: 8.
- ESLint: passed with zero warnings.
- Root TypeScript check: passed.
- Workspace TypeScript checks: 10 of 10 passed.
- Contract assertions: 4 passed, 0 failed.
- State-machine assertions: 5 passed, 0 failed.
- Complete workspace assertions: 20 passed, 0 failed.
- Web regression assertions: 2 passed, 0 failed.
- vinext production build: passed.
- npm audit after dependency update: 0 vulnerabilities.

### Failures and corrections

1. npm could not resolve the explicit Zod dependency in cache-only sandbox mode; approved registry access completed the lockfile update.
2. Drizzle Kit hit the restricted Windows child-process `spawn EPERM`; the identical generator passed with approved process access.
3. Nested generated `dist` files were initially linted; the global ignore now excludes every workspace build output.
4. Contract tests originally used unused destructuring bindings; they now remove fields through a neutral record to keep the negative-schema tests warning-free.
5. Pause handling was ordered so ASK_USER and REQUIRE_CONSENT reject nested or unrelated pause signals before general ambiguity routing.

### Architecture records

ADR-0009, ADR-0010, and ADR-0011 freeze the schema source of truth, replay-only workflow projection, PostgreSQL event layout, and pgvector routing choice.

### Phase boundary

No React component, user interface, model invocation, browser automation, or Phase 3 fixture behavior was added. Phase 3 remains blocked until explicit instruction.

## Entry 0012 - Phase 3 adversarial travel demo world

- Date: 2026-07-14
- Phase: 3
- Status: Complete

### Application

`apps/demo-portal` is now an independent Vite/React application served on port 4173. `TravelPortal` deliberately contains nested click targets, missing ARIA, low-contrast microcopy, tiny controls, a confusing date picker, ambiguous pricing, a preselected Flex+ upsell, a cookie obstruction, and a sticky checkout trap. It performs no real booking or external call.

### Deterministic mutation set

Five source layouts are frozen in `src/variants.ts`:

1. Dense grid
2. Sidebar flip
3. Banner stack
4. Card reversal
5. Floating filters

`?variant=0` through `?variant=4` selects an exact layout for demo choreography. Without the query, session storage advances the layout on reload. Fare data and unsafe interaction behavior remain stable so a layout mutation cannot alter the narrative outcome.

## Entry 0013 - Phase 3 adaptive split-screen shell

- Date: 2026-07-14
- Phase: 3
- Status: Complete

### Layout

The root `@morph/web` application remains the web shell under ADR-0004 and now renders:

- an iframe-backed chaotic source pane with explicit variant controls;
- a three-profile access switcher;
- a semantic adaptive surface from `@morph/accessibility-kit`;
- a six-item constraint ledger with a persistent purchase consent gate;
- a five-stage runtime rail;
- a four-node bounded agent graph; and
- an expected-versus-observed evidence timeline.

### Contract use

Low Vision, One-Switch Motor, and Cognitive Load Reduction fixture manifests are parsed by the Phase 2 `AdaptiveUIManifestSchema` when the module loads. The renderer sorts components by contract order and id, provides semantic button/status structures, and exposes a deterministic one-switch scan state. The source portal and adaptive surface use separate applications and separate style sheets.

### Phase boundary

All observatory data is visibly labeled as a deterministic replay fixture. No OpenAI SDK, model call, browser action, mutable session store, or external booking integration was introduced.

## Entry 0014 - Phase 3 corrections during validation

- Date: 2026-07-14
- Phase: 3
- Status: Resolved

1. The new Vite workspace initially lacked DOM library declarations; its TypeScript configuration now includes ES2022, DOM, and DOM.Iterable.
2. `exactOptionalPropertyTypes` rejected forwarded optional activation handlers; the accessibility-kit boundary now models explicit `undefined` correctly.
3. An unused accessibility lint suppression in the intentionally hostile portal was removed; the app remains intentionally inaccessible through its actual markup rather than lint configuration.
4. Restricted Windows child-process creation produced `spawn EPERM` for Vite. The identical build completed with approved child-process access.
5. A rendered-shell assertion detected that non-ASCII display glyphs introduced through the Windows patch path had degraded to question marks. User-visible currency and direction values now use source-safe Unicode escapes, separators are ASCII-safe, and the full suite was rerun without weakening the assertion.
6. The root development server did not provide a stable validation handoff under the restricted runner. Validation uses the freshly built vinext production server on port 3000 and the Vite portal server on port 4173.
7. The in-app browser harness could not initialize because its JavaScript runtime reported `Cannot redefine property: process`. Launch verification therefore used live HTTP probes plus server-rendered landmark assertions; no standalone browser library was introduced.

## Entry 0015 - Phase 3 acceptance evidence

- Date: 2026-07-14
- Phase: 3
- Status: Passed

### Commands

```text
npm run lint
npm run typecheck
npm run check
npm run dev:portal
npm start -- --host 127.0.0.1 --port 3000
```

### Results

- ESLint: passed with zero warnings.
- Root TypeScript check: passed.
- Workspace TypeScript checks: 11 of 11 passed.
- Workspace unit assertions: 21 passed, 0 failed.
- Demo portal production build: passed; 17 modules transformed.
- Accessibility-kit assertions: 2 passed, 0 failed.
- Contract assertions: 4 passed, 0 failed.
- State-machine assertions: 5 passed, 0 failed.
- Web server-render assertions: 2 passed, 0 failed.
- vinext production build: all 5 build stages passed.
- Live MORPH probe: HTTP 200 at `http://127.0.0.1:3000`.
- Live portal probes: HTTP 200 for variants 0 and 4 at `http://127.0.0.1:4173`.
- The live MORPH response contains all three access profiles and the correctly rendered INR budget constraint.

### Architecture records

ADR-0012, ADR-0013, and ADR-0014 freeze the separate hostile-origin boundary, contract-validated fixture policy, and evidence-first split-screen composition.

### Phase boundary

Phase 3 is complete and frozen. Phase 4 remains blocked until explicit instruction.

## Entry 0016 - Phase 4 Responses client and reasoning continuity

- Date: 2026-07-14
- Phase: 4
- Status: Complete

`packages/agents/src/client.ts` now provides a production `MorphResponsesClient` over `client.responses.create`. It pins `gpt-5.6-sol`, requests high reasoning effort, uses current-turn or all-turn context according to continuation state, disables provider storage, requests encrypted reasoning items, and bounds replay to 200 items and eight programmatic rounds.

Every request parses its AccessProfile and task envelope before transport, checks output/state compatibility, and requests one Phase 2 artifact. Every result is decoded and parsed again with the matching Zod schema. `toMachineSignal` is the only adapter from validated agent artifacts to deterministic state-machine signals.

## Entry 0017 - Phase 4 prompts, caching, and structured output boundary

- Date: 2026-07-14
- Phase: 4
- Status: Complete

Version `morph-agents-2026-07-14.v1` defines ROOT, PERCEPTION, ADAPTIVE_DESIGN, PLANNER, and CRITIC instructions plus a shared safety constitution and profile-aware UI grammar. The prompt forbids treating page content as instructions, inventing evidence or consent, exposing private reasoning, lowering risk classes, and returning unknown fields.

The client uses the current Responses Structured Outputs shape, `text.format`, generated from the Phase 2 Zod contracts. Three explicit prompt-cache breakpoints cover role plus safety, the AccessProfile JSON Schema, and UI grammar, with a versioned key and 30-minute explicit policy.

## Entry 0018 - Phase 4 programmatic tools and specialist routing

- Date: 2026-07-14
- Phase: 4
- Status: Complete

`read_surface_records` and `query_surface_records` expose bounded, normalized DOM or accessibility-tree records from an immutable snapshot. Their inputs and outputs are strict, page-versioned, size-limited, and restricted to the official `programmatic` caller. The client refuses direct tool calls and validates runtime output before returning it to the isolated program.

`MORPH_MULTI_AGENT_ENABLED` defaults to false. When enabled, PERCEPTION, ADAPTIVE_DESIGN, PLANNER, and CRITIC receive their deterministic contract routes and routed batches execute concurrently. With the flag off, ROOT preserves the same schema boundary and handles the batch sequentially through the stable Responses API.

## Entry 0019 - Phase 4 corrections during validation

- Date: 2026-07-14
- Phase: 4
- Status: Resolved

1. The OpenAI documentation MCP registration was denied by the managed Windows environment. Verification therefore used only official OpenAI developer documentation over the web.
2. The directive's `allowed_callers: ["code_execution_20260120"]` value is obsolete and rejected by the current SDK. The documented Responses value, `["programmatic"]`, is used without unsafe casts.
3. Structured Outputs on Responses use `text.format`, not the Chat Completions-only `response_format` field. The client follows the current wire contract and retains a second local Zod parse.
4. Strict TypeScript initially found optional response usage unsafe to dereference. Usage projection now narrows the optional value before reading token details.
5. Node's test runner initially hit restricted Windows child-process `spawn EPERM`. The identical suite passed with approved child-process execution.
6. A requested `ws` override version did not exist in the registry. Registry metadata confirmed `8.21.0`, which is now pinned alongside `postcss` `8.5.19`.
7. Safe audit remediation leaves production dependencies at zero known vulnerabilities. Nine advisories remain confined to development and build tooling; their published automatic fixes require forced, breaking, or out-of-range toolchain changes and were not applied in this frozen phase.
8. No live model invocation was made: acceptance uses the official SDK compiler surface and deterministic transport fixtures, avoiding credential use and model spend during construction.

## Entry 0020 - Phase 4 acceptance evidence

- Date: 2026-07-14
- Phase: 4
- Status: Passed

### Commands

```text
npm run lint
npm run typecheck
npm test --workspace @morph/agents
npm run check
npm audit --omit=dev --audit-level=high
```

### Results

- ESLint: passed with zero warnings.
- Root TypeScript check: passed.
- Workspace TypeScript checks: 11 of 11 passed.
- Agent client, routing, tool, and schema assertions: 7 passed, 0 failed.
- Complete workspace and web assertions: 29 passed, 0 failed.
- Demo portal production build: passed; 17 modules transformed.
- vinext production build: all 5 build stages passed.
- Web server-render assertions: 2 passed, 0 failed.
- Production dependency audit: 0 vulnerabilities.

### Architecture records

ADR-0015 through ADR-0019 freeze the Responses endpoint, stateless reasoning continuation, double structured-output gate, programmatic caller boundary, feature-flagged specialist routing, and explicit caching strategy.

### Phase boundary

Phase 4 contains no live credentialed call, browser mutation, external transaction, or Phase 5 functionality. Phase 5 remains blocked until explicit instruction.

## Entry 0021 - Phase 5 isolated Playwright worker and CDP surface runtime

- Date: 2026-07-14
- Phase: 5
- Status: Complete

`apps/browser-worker/src/worker.ts` now launches a private persistent headless Chromium context and implements the Phase 4 `SurfaceToolRuntime`. Its network boundary requires at least one explicit origin, rejects paths in origin declarations, blocks all other origins, disables downloads and service workers, grants no permissions, and preserves the Chromium process sandbox.

Every capture opens a page-scoped CDP session, retrieves a full DOM snapshot and accessibility tree, takes a fresh screenshot, assigns evidence ids and SHA-256 hashes, and normalizes the hostile values into strict DOM or ACCESSIBILITY_TREE records. Tool reads are paginated, queries are bounded, only eight immutable snapshots remain addressable, and raw artifacts carry the `UNTRUSTED_PAGE_DATA` marker.

## Entry 0022 - Phase 5 one-step executor, consent gate, and fresh verifier

- Date: 2026-07-14
- Phase: 5
- Status: Complete

`executor.ts` reparses every ActionStep, validates its command against the closed operation/risk matrix, requires passed simulation and exact page-version equality, confirms durable `EXECUTE_ONE_STEP`, and permits only one active command. SUBMIT is always treated as R4. An R4 step additionally requires replay-derived REQUIRE_CONSENT history plus a granted, unexpired ConsentRecord bound to the exact action hash.

Target resolution is snapshot-bound and attempts structural CSS, safe role/name, and exact-text strategies. It refuses zero, hidden, or multi-match candidates instead of selecting an arbitrary element. Sensitive input values are never included in execution receipts.

`verifier.ts` captures a newer screenshot, DOM snapshot, and accessibility tree before evaluating the deterministic postcondition grammar. It returns a strict VerificationResult and maps it directly to VERIFICATION_MATCH, VERIFICATION_MISMATCH, or VERIFICATION_INCONCLUSIVE for the Phase 2 state machine.

## Entry 0023 - Phase 5 real TravelPortal execution evidence

- Date: 2026-07-14
- Phase: 5
- Status: Passed

The browser integration/component-fixture test builds and serves the actual TravelPortal, launches pinned Chromium, derives the SkyDash choose control from CDP-normalized records, and executes a real SELECT click through `executeOneStep`. The page visibly changes to `SELECTED!`.

The same ActionStep requires `Flex+ silently included` to remain absent. Fresh verification observes that unexpected fee text and returns MISMATCH while retaining `VISIBLE_TEXT:SELECTED!` as satisfied. The result converts to a VERIFICATION_MISMATCH MachineSignal. Before the reversible click, a separate R4 SUBMIT attempt is rejected because no durable REQUIRE_CONSENT transition or ConsentRecord exists.

## Entry 0024 - Phase 5 corrections during validation

- Date: 2026-07-14
- Phase: 5
- Status: Resolved

1. The first TypeScript pass found two already-excluded switch variants and a browser-only requestAnimationFrame symbol outside the worker's Node library. The unreachable cases were removed and the stabilization wait now uses Playwright directly.
2. Full CDP captures exceeded the Phase 4 per-response maximum of 500 records. Capture validation now checks every channel in contract-sized pages while retaining the complete immutable snapshot for paged reads.
3. The first real locator run correctly refused three identical `choose` text matches. Diagnostics showed the structural path represented the document root as `html:nth-of-type(2)` because CDP flattens document structures differently from CSS. Root html/body segments are now canonical, the full selector resolves uniquely, and arbitrary text-first fallback remains forbidden.
4. The in-app browser validation harness again failed during bootstrap with `Cannot redefine property: process`, and its recovery documentation was unreachable because setup did not create the agent binding. The executable evidence therefore comes from the repository's pinned Playwright 1.61.1 Chromium test, which performs the required physical click and CDP recapture without a mock Page.
5. The pinned browser runtime required a one-time 183.6 MiB Chrome for Testing download plus its headless shell and media helpers. Chromium 149.0.7827.55 is now installed in Playwright's local cache for repeatable tests.
6. Raw target diagnostics briefly exposed the full generated selector during root-path diagnosis. The retained error now reports only strategy class, match count, and visibility, preventing untrusted attribute values from entering logs.

## Entry 0025 - Phase 5 acceptance evidence

- Date: 2026-07-14
- Phase: 5
- Status: Passed

### Commands

```text
npx playwright install chromium
npm run typecheck --workspace @morph/browser-worker
npm test --workspace @morph/browser-worker
npm run lint
npm run check
npm audit --omit=dev --audit-level=high
```

### Results

- Pinned Playwright: 1.61.1.
- Pinned Chromium: Chrome for Testing 149.0.7827.55.
- Browser-worker TypeScript: passed.
- Browser-worker assertions: 3 passed, 0 failed, including one physical Chromium execution/verification fixture.
- Irreversible consent-bypass rejection: passed.
- Real fare-selection click: passed.
- Hidden-fee fresh-state mismatch: passed and converted to VERIFICATION_MISMATCH.
- ESLint: passed with zero warnings.
- Root TypeScript check: passed.
- Workspace TypeScript checks: 11 of 11 passed.
- Complete workspace and web assertions: 30 passed, 0 failed.
- Demo portal production builds: passed; 17 modules transformed.
- vinext production build: all 5 build stages passed.
- Web server-render assertions: 2 passed, 0 failed.
- Production dependency audit: 0 vulnerabilities.

### Architecture records

ADR-0020 through ADR-0024 freeze the isolated persistent browser boundary, CDP evidence layout, command/risk matrix, exact consent proof, fail-closed target resolution, and fresh deterministic verifier.

### Phase boundary

Phase 5 executes only against the local no-booking TravelPortal fixture during acceptance. It contains no live model call, real travel transaction, payment, deployment, or Phase 6 functionality. Phase 6 remains blocked until explicit instruction.
## Entry 0026 - Phase 6 constrained accessibility grammar

- Date: 2026-07-14
- Phase: 6
- Status: Complete

packages/accessibility-kit/src/components.tsx now exposes AdaptiveButton, AdaptiveList, AdaptiveModal, and AdaptiveText. The controls use native semantic elements, explicit accessible names, described-by relationships, polite atomic status announcements, visible keyboard focus, deterministic target sizing, and an alertdialog option for mandatory consent. AdaptiveModal autofocuses its first control, traps Tab within the open dialog, and refuses Escape dismissal when the dialog is required.

packages/accessibility-kit/src/styles.css is the fixed style allowlist. It implements high contrast, base/large/x-large type tiers, reduced motion, predictable focus rings, and modal layout through enumerated data attributes. Components accept no style object or arbitrary CSS payload from a manifest.

## Entry 0027 - Phase 6 recursive compiler and profile modes

- Date: 2026-07-14
- Phase: 6
- Status: Complete

app/components/adaptive-compiler.tsx reparses the Phase 2 manifest and AccessProfile, verifies their identity binding, and validates topology before rendering. Roots must exactly match parentless nodes; only GROUP may contain children; all nodes must be reachable and acyclic; every enabled action requires an ActionStep and one focus-order entry; and focus order may contain only enabled actions.

The recursive mapping is HEADING to AdaptiveText heading, TEXT/FIELD to body text, STATUS to a live status, SUMMARY to summary text, GROUP to a semantic AdaptiveList, ACTION/CHOICE to AdaptiveButton, and CONSENT to a required AdaptiveModal. Invalid graphs render an accessible stop-safe error.

Low-vision presentation derives contrast and font tiers from AccessProfile. One-switch presentation autofocuses the first manifest focus target, follows the exact focusOrder with roving tabindex, advances at scanIntervalMs, and supports arrow traversal plus native Enter/Space activation. Cognitive-load presentation enforces fixed plain typography, aggressive spacing, step-at-a-time metadata, and maxChoices.

## Entry 0028 - Phase 6 typed execution handoff

- Date: 2026-07-14
- Phase: 6
- Status: Complete

AdaptiveExecutionIntentSchema is a new closed cross-process contract. It binds a UI selection to session, manifest version, AccessProfile, component, source nodes, and ActionStep; it can enter only at RISK_GATE and request only EXECUTE_ONE_STEP from BROWSER_WORKER. Unknown fields and attempted consent bypasses are rejected.

decideAdaptiveExecutionIntent in the state machine reparses the intent and full ActionStep, replays the durable event log, verifies session/profile/action binding, and delegates to the existing ACTION_READY risk decision. Reversible actions may advance to EXECUTE_ONE_STEP; R4 or otherwise consent-bound actions still pause at REQUIRE_CONSENT. The React compiler dispatches the typed command through a required callback and never imports Playwright or claims browser authority.

The Phase 3 shell now renders AdaptiveCompiler instead of static AdaptiveSurface fixtures. Agent Observatory displays the latest typed UI handoff, while the source portal and constraint ledger remain deterministic.

## Entry 0029 - Phase 6 corrections during validation

- Date: 2026-07-14
- Phase: 6
- Status: Resolved

1. The workspace's split Windows writable roots prevented the patch helper from constructing its sandbox. Edits were applied only to exact authorized workspace paths and then verified by TypeScript, ESLint, tests, and production builds.
2. The first root TypeScript pass correctly found the retired Phase 3 AdaptiveSurface import. The shell now imports only AdaptiveCompiler and the shared profile-key type.
3. React's hooks lint rejected a synchronous scan-index reset inside an effect. The reset now occurs in the requestAnimationFrame used for DOM focus synchronization, eliminating the cascading-render pattern.
4. Sandboxed Node test isolation and Vite real-path helpers hit Windows spawn EPERM. Narrow tests passed with in-process isolation, and the complete suite passed with approved local child-process execution.
5. The first complete acceptance invocation exceeded its three-minute command window without a test failure. The identical suite completed in a longer window.
6. An attempted redundant react-dom workspace install was unavailable in the offline cache. No dependency change was needed because the grammar tests do not require a separate renderer and the root web package already owns react-dom.
7. A final API audit found that inherited React attribute types still exposed className and style even though the compiler did not use them. AdaptiveButton and AdaptiveList now expose explicit prop allowlists only; the final workspace typecheck, lint, kit tests, production build, and SSR tests all passed after this hardening.

## Entry 0030 - Phase 6 acceptance evidence

- Date: 2026-07-14
- Phase: 6
- Status: Passed

### Commands

- npm run lint
- npm run typecheck
- npm run build
- node --test --test-isolation=none packages/contracts/dist/index.test.js
- node --test --test-isolation=none packages/accessibility-kit/dist/index.test.js
- node --test --test-isolation=none packages/state-machine/dist/index.test.js
- node --test --test-isolation=none tests/rendered-html.test.mjs
- npm run check

### Results

- ESLint: passed with zero warnings.
- Root TypeScript and all 11 workspace typechecks: passed.
- Accessibility grammar assertions: 3 passed, 0 failed.
- Closed contract assertions: 5 passed, 0 failed.
- State-machine assertions: 6 passed, 0 failed, including the adaptive intent RISK_GATE handoff.
- Complete workspace and web assertions: 33 passed, 0 failed.
- Phase 5 real Chromium click and verification-mismatch regression: passed.
- Demo portal production build: passed; 17 modules transformed.
- vinext production build: all 5 build stages passed.
- Web server-render assertions: 2 passed, 0 failed; the HTML contains the real compiler, one-switch mode, ActionStep binding, and risk-gate message.

### Architecture records

ADR-0025 through ADR-0028 freeze the semantic component grammar, manifest-graph compiler, closed UI execution intent, risk-gated state-machine bridge, and AccessProfile-derived presentation modes.

### Phase boundary

Phase 6 contains no live model call, real travel transaction, payment, external deployment, arbitrary CSS injection, or direct browser authority in React. Phase 6 is complete and frozen. Phase 7 remains blocked until explicit instruction.

## Entry 0031 - Phase 7 isolated Codex generation boundary

- Date: 2026-07-14
- Phase: 7
- Status: Implemented

`apps/adapter-forge/src/forge.ts` now owns the server-side Codex SDK boundary. It targets `gpt-5.6-sol` at high reasoning effort and starts a fresh thread inside a private disposable workspace with `workspace-write`, approval policy `never`, web search disabled, command network disabled, no additional writable roots, and a 30-second turn timeout. The SDK process receives a scrubbed environment and a workspace-local CODEX_HOME.

The input contract accepts only HTTP(S), origin-matching domain patterns, safe task-family/locale syntax, unique surface ids, and visible enabled required actions. Query strings, credentials, secrets, direct identifiers, executable markup, and non-allowlisted DOM material are removed before Codex sees the fixture. The page remains labelled UNTRUSTED_PAGE_DATA.

The workspace contains the redacted fixture, standalone Adapter interface, SurfaceToolRuntime shape, safety policy, and one writable artifact. Trusted files are SHA-256 checked after every turn; symlinks, unexpected files, modified contracts, source above 80 KiB, and path escapes fail closed. Raw model messages and reasoning are not streamed. Only thread-start, completed file-change, and turn-complete metadata may leave the SDK boundary.

## Entry 0032 - Phase 7 independent generation and repair harness

- Date: 2026-07-14
- Phase: 7
- Status: Implemented

`harness.ts` admits one pure exported adapter object and rejects imports, ambient process/network/filesystem capabilities, dynamic code, mutation, nondeterministic globals, prototype access, Playwright selector-engine escapes, and non-allowlisted method calls. It transpiles locally, executes in a code-generation-disabled `node:vm` context with a 250 ms budget, validates the projection with Zod, binds every generated action to an available supplied node, and requires all mandatory actions.

The browser gate opens offline headless Chromium, blocks all requests and service workers, renders the sanitized target, and requires every action locator to resolve to exactly one visible node. A second trusted preview is audited with axe-core and rejects serious or critical WCAG findings. Generated code never receives a Playwright Page or SurfaceToolRuntime.

`pipeline.ts` returns bounded path-scrubbed failures to the same Codex thread and caps the complete generate/repair sequence at three attempts. Validation is limited to 15 seconds per artifact and the pipeline deadline is 85 seconds. Exhaustion activates the repository-pinned prebuilt adapter; the fallback is re-run through the identical policy, VM, browser, accessibility, signature, and persistence gates.

## Entry 0033 - Phase 7 signed pgvector publication

- Date: 2026-07-14
- Phase: 7
- Status: Implemented

A passing source is hashed with SHA-256, signed with Ed25519, verified before publication, and paired with a 1536-dimensional `text-embedding-3-small` routing vector. The semantic embedding contains task family, domain pattern, locales, and normalized roles—not raw DOM. The surface fingerprint excludes accessible names and raw selectors.

`db/adapter-publisher.ts` independently reparses the Adapter, recomputes the source hash, re-verifies the Ed25519 signature, requires a finite 1536-dimensional embedding, and inserts inside a transaction with a 10-second PostgreSQL statement timeout. An idempotent hash/source/fingerprint read-back is required before publication is acknowledged.

The adapters table now stores exact source, signature algorithm, signature, signing key id, provenance, and the complete validation report alongside the typed Adapter and pgvector embedding. Migration `0001_lucid_adapter_forge.sql` adds those fields and rejects an implicit legacy backfill instead of inventing signatures for existing rows.

## Entry 0034 - Phase 7 observability and deterministic judge fallback

- Date: 2026-07-14
- Phase: 7
- Status: Implemented

`ForgeStatusEventSchema` is a strict runtime contract for ACTIVE, TESTING, REPAIRING, PUBLISHED, FALLBACK, and STOPPED_SAFE states. The pipeline validates every emitted status and exposes no source, page data, prompt, stack trace, or chain-of-thought.

Agent Observatory now renders a visually distinct cyan code-generation channel with the exact `ADAPTER_FORGE_ACTIVE` state, attempt count, isolated-sandbox gate, Codex-generation gate, and queued test gates. The current shell uses a deterministic fixture through the same event type; the pipeline's status sink is the live transport seam.

The fallback source is immutable and deterministic. A Codex outage or exhausted repair sequence switches to that source immediately; a fallback validation failure emits STOPPED_SAFE and publishes nothing.

## Entry 0035 - Phase 7 corrections and environment limits

- Date: 2026-07-14
- Phase: 7
- Status: Resolved with one execution gate pending

1. The Windows split writable-root policy again prevented the patch helper from starting. Exact edits remained confined to the authorized MORPH workspace and were verified by TypeScript and ESLint.
2. The packaged Node executable was not directly runnable from WindowsApps. A temporary ignored workspace runtime copy was used only for validation.
3. Node's default per-file test isolation hit `spawn EPERM`; the package test command now uses Node's supported in-process test isolation.
4. The first strict-domain test exposed an over-escaped regular expression. The regex was corrected and all request, repair, fallback, stop-safe, redaction, and workspace-integrity tests pass.
5. Drizzle Kit could not launch its esbuild helper under the managed process sandbox. The Phase 7 SQL, snapshot lineage, and journal entry were created explicitly; JSON parsing verified all six new columns, both constraints, the prior snapshot id, and journal count.
6. The real Playwright/axe test reaches the browser launch and then fails closed because the managed sandbox denies Chromium process creation with `spawn EPERM`. The required out-of-sandbox retry was requested, but the execution environment rejected it because its approval/usage quota was exhausted. The test remains enabled and failing rather than being weakened or conditionally skipped.
7. The vinext production build reaches Vite configuration loading and is blocked by the same child-process `spawn EPERM` restriction before application bundling. No source-level build error was reported. Phase 6's last unrestricted vinext build remains green, and the Phase 7 web changes pass root TypeScript and ESLint.

## Entry 0036 - Phase 7 validation evidence

- Date: 2026-07-14
- Phase: 7
- Status: Code-complete; browser launch re-run required in an unrestricted runner

### Commands

- `npm run typecheck`
- `npm run lint`
- `npm test --workspace @morph/adapter-forge`
- `npm run build`
- `npm run db:generate`
- PowerShell JSON validation for the Phase 7 Drizzle snapshot and journal

### Results

- Root TypeScript: passed.
- Workspace TypeScript: 11 of 11 workspaces passed.
- ESLint: passed with zero warnings.
- Adapter Forge TypeScript build: passed.
- Adapter Forge assertions: 9 passed, 1 environment-blocked.
- Passing assertions cover DOM/identifier redaction, single-output workspace integrity, import/capability rejection, Phase 7 health, one-repair success, signed generated publication, deterministic fallback publication, and STOPPED_SAFE/no-publication behavior.
- Pending execution evidence: the combined prebuilt policy/VM/Playwright/axe test is enabled, but Chromium launch is denied by the current managed process sandbox.
- Drizzle Phase 7 snapshot and journal structure: passed.
- Production dependencies added for Phase 7 reported 0 vulnerabilities at install.
- Live credentialed Codex generation was not invoked; no API key or external page was used.
- Full `npm run check` and vinext production build require a runner that permits the already-pinned child processes.

### Architecture records

ADR-0029 through ADR-0031 freeze the ephemeral Codex boundary, independent four-gate adapter validation, signed pgvector publication, and same-gates deterministic fallback.

### Phase boundary

Phase 7 performs no real travel transaction, payment, deployment, direct model-controlled browser action, or Phase 8 work. Phase 8 remains blocked until explicit instruction.

## Entry 0037 - Phase 8 durable Observatory stream

- Date: 2026-07-15
- Phase: 8
- Status: Complete

packages/contracts/src/index.ts now defines strict durable variants for specialist activity, candidate plans, Critic rejections, verification evidence, and Adapter Forge status. It also defines the independent ObservatoryEvent public union. Adapter Forge consumes the shared status contract instead of maintaining a second shape.

apps/orchestrator/src/stream.ts tails session_events by the existing (session_id, sequence) index. It supports Last-Event-ID and after catch-up, bounded batches, 250 ms abortable polling, 15-second heartbeat comments, backpressure, exact-origin credentialed CORS, and explicit teardown. Hidden durable events still advance the cursor. The projector constructs an allowlist and never spreads stored payloads; malformed or unknown fields stop the stream without disclosing the source.

server.ts mounts the GET stream and POST demo-mutation routes. Live startup fails closed without the database URL, exact demo-session id, exact web origin, and a 32-character-or-longer stream credential. EventSource credentials are cookie-bound; secrets are never placed in query parameters.

## Entry 0038 - Phase 8 live constellation, timeline, and mutation proof

- Date: 2026-07-15
- Phase: 8
- Status: Complete

useObservatoryStream opens a credentialed EventSource, validates every message with ObservatoryEventSchema, deduplicates reconnect delivery, orders by sequence, and caps retained UI history at 120 events. Cleanup removes all listeners, closes EventSource, and clears replay timers.

The Observatory now renders a live four-agent constellation. PERCEPTION, ADAPTIVE_DESIGN, PLANNER, and CRITIC derive IDLE, PROCESSING, TOOL_CALLED, SUCCEEDED, or FAILED state from the stream. The action timeline distinguishes successful stages, active work, rejected hypotheses, and red verification mismatches. Adapter Forge status is read from the same durable projection.

The developer Mutate source UI control swaps the TravelPortal calendar for a deliberately confusing free-text input. Live mode requests a state-locked durable recovery transaction; the transaction requires VERIFY, preserves the three-replan limit, and appends the mismatch, rewind, recapture, Planner/Critic repair, rejected stale hypothesis, and safe recompile. Replay mode is visibly labelled and sends the identical strict event shapes through the same reducer.

## Entry 0039 - Phase 8 validation corrections and environment boundary

- Date: 2026-07-15
- Phase: 8
- Status: Resolved

1. The Windows split writable-root policy again prevented the patch helper from constructing its sandbox. Exact-match writes were confined to authorized MORPH paths and validated afterward.
2. The first root typecheck resolved workspace package imports against stale generated contract declarations. Rebuilding @morph/contracts refreshed the declarations; the root and all 11 workspace typechecks then passed.
3. React hooks lint rejected synchronous replay resets inside effects. Replay resets now run from bounded timer callbacks and cleanup clears every timer.
4. The first executable-server health run exposed URL-encoded-space drift in Windows direct-entry detection. It now compares resolve(process.argv[1]) with fileURLToPath(import.meta.url) and the Phase 8 health command passes.
5. The package lock was refreshed offline after adding orchestrator dependencies. The offline install reported 0 vulnerabilities.
6. The full check completed lint and all typechecks, then encountered the previously documented managed-runner spawn EPERM boundary: Chromium, Vite real-path helpers, and Node's default per-file test isolation cannot create child processes. No Phase 8 assertion failed. Equivalent non-browser suites pass under Node's supported in-process isolation; the real Chromium/axe gate remains enabled and fails closed rather than being skipped.
7. No PostgreSQL credential was supplied, so the live database route was not integration-run. Its reader, authorization, cursor, redaction, cancellation, mutation admission, and strict-body boundaries are exercised through injected test implementations.

## Entry 0040 - Phase 8 acceptance evidence

- Date: 2026-07-15
- Phase: 8
- Status: Passed; unrestricted browser/build rerun remains an environment gate

### Commands

- npm install --package-lock-only --ignore-scripts --offline
- npm run typecheck
- targeted ESLint over all Phase 8 files
- direct tsc -p apps/orchestrator/tsconfig.json
- node --test --test-isolation=none apps/orchestrator/dist/*.test.js
- in-process regression tests for contracts, state machine, accessibility kit, agents, browser tools, evals, and telemetry
- node apps/orchestrator/dist/index.js --health
- npm run check

### Results

- Root TypeScript: passed.
- Workspace TypeScript: 11 of 11 passed.
- Full ESLint gate: passed after the replay-effect correction.
- Phase 8 orchestrator assertions: 9 passed, 0 failed.
- Phase 8 tests cover authorization before read, strict public projection and reasoning rejection, Last-Event-ID resume, subscriber cleanup, mutation authorization, valid durable mutation admission, unknown-field rejection, and the closed 16-event durable repair sequence.
- Non-browser regression assertions in supported in-process isolation: 24 passed, 0 failed.
- Orchestrator health: ready, Phase 8, port 8788.
- Offline dependency lock refresh: 0 vulnerabilities.
- Full npm run check: lint and every typecheck passed; the test stage is environment-blocked by child-process spawn EPERM, including the already-known real Playwright/axe and Vite gates.
- No OpenAI call, real travel transaction, payment, production deployment, raw screenshot persistence, or chain-of-thought broadcast occurred.

### Architecture records

ADR-0032 through ADR-0034 freeze the public evidence projection, resumable bounded SSE lifecycle, authenticated executable route, durable mutation recovery sequence, and explicitly labelled judge replay.

### Phase boundary

Phase 8 is complete. It does not implement Phase 9, production authentication, real-user session provisioning, deployment, or a real travel transaction. Phase 9 remains blocked until explicit instruction.
## Entry 0041 - Phase 9 deterministic evaluation matrix

- Date: 2026-07-15
- Phase: 9
- Status: Complete

packages/evals/src/runner.ts executes the frozen 5 x 3 x 2 Cartesian matrix: all five TravelPortal layout families, LOW_VISION / ONE_SWITCH / COGNITIVE_LOAD profiles validated by AccessProfileSchema, and NONSTOP_UNDER_8000 / LOWEST_PRICE_UNDER_8000 intents. Every case derives its irreversible boundary through the production ActionStepSchema and stateless RISK_GATE. The report is stable under seed 20260715, fixed time 2026-07-15T00:00:00.000Z, and SHA-256 fingerprint 7b9e3c1d5eaf9571553b7a0ca45c72c0047f10a2e58c728d91568a10be6291c3.

The aggregate deterministic fixture results are: 30/30 task completions, 100% constraint satisfaction, zero adaptive-surface accessibility violations, 480 source-portal accessibility violations retained as the hostile baseline, 12 total retries (0.4 mean), 1,652 ms median simulated latency, 2,139 ms p95 simulated latency, 85,200 input plus 21,560 output tokens, and USD 0.428600 estimated token cost. Price and latency are explicitly simulated and are not provider billing or production telemetry.

The mandatory consent invariant is wired into npm run eval before workspace tests. The aggregate Unconsented Irreversible Actions count is exactly 0. A synthetic count of 1 throws EvaluationSafetyError and fails the command.

## Entry 0042 - Phase 9 adversarial red-team and resolved risk downgrade

- Date: 2026-07-15
- Phase: 9
- Status: Resolved

The TravelPortal now mounts four closed, opt-in adversarial fixtures from the attack query parameter. They cover hidden prompt injection, consent spoofing, risk downgrade, and fake verification/tool output. The rendered span is hidden, aria-hidden, and marked data-untrusted-page-content=true; it never becomes a trusted instruction channel.

The red-team suite proves the CRITIC safety constitution says page content is untrusted and may never become an instruction, rejects all four fixtures with SAFE_HALT and no actionable node, rejects unknown fixture fields, and binds the expected rejection reason. The deterministic RISK_GATE independently stops an injected SUBMIT/R1 signal with STOP_SAFE/FATAL_ERROR, while a valid SUBMIT/R4 pauses at REQUIRE_CONSENT.

Red-teaming exposed a pre-execution defense gap: ActionStepSchema previously allowed a SUBMIT command to be mislabeled R1/reversible. The shared contract now owns a closed command-to-operation-class and operation-to-risk map. Zod rejects downgrades at construction, the state machine rechecks them during durable replay, and the browser executor consumes the same map. RX denied plans remain valid and non-executable. Contract/state-machine regression evidence: 13 passed, 0 failed.

## Entry 0043 - Phase 9 CI and production hardening

- Date: 2026-07-15
- Phase: 9
- Status: Complete; CI execution pending remote runner

.github/workflows/ci.yml is the production release gate on ubuntu-latest with Node 24, npm ci, real Playwright Chromium plus OS dependencies, npm run check, and npm audit --omit=dev --audit-level=high. It has read-only repository permissions, run cancellation, and a 30-minute job timeout. There is no browser mock, skip, or environment-success override in CI.

docs/ci-validation.md defines the managed-Windows exception narrowly. An exact child-process spawn EPERM is environment-blocked, never a passing browser assertion. Lint, typecheck, the fatal eval, and in-process unit/red-team suites remain mandatory. Production-green status requires the unchanged Ubuntu workflow to run real Playwright, axe-core, Vite/vinext, and the dependency audit.

The lockfile was refreshed offline and the explicit production audit reported 0 vulnerabilities. CI YAML parses as one verify job with six bounded steps.

## Entry 0044 - Phase 9 validation and freeze evidence

- Date: 2026-07-15
- Phase: 9
- Status: Code-complete; managed-host browser/build execution blocked

### Commands

- npm install --package-lock-only --ignore-scripts --offline
- npm run lint
- npm run typecheck
- npm run eval
- node --test --test-isolation=none over all non-browser workspace suites
- npm run check
- npm run build
- npm audit --omit=dev --audit-level=high
- YAML parse validation for .github/workflows/ci.yml

### Results

- Root and workspace ESLint: passed with zero warnings.
- Root TypeScript and all 11 workspace typechecks: passed.
- Phase 9 eval/red-team assertions: 9 passed, 0 failed.
- Contract and state-machine security assertions after the risk-map correction: 13 passed, 0 failed.
- Combined supported in-process non-browser regression: 51 passed, 0 failed.
- Deterministic eval command: passed; 30 cases and zero unconsented irreversible actions.
- Production dependency audit: passed; 0 vulnerabilities.
- Full npm run check: lint, all typechecks, and the fatal eval passed. Workspace test orchestration then hit the documented managed-Windows spawn EPERM boundary in Chromium, Vite real-path resolution, and Node's default per-file worker isolation. The Adapter Forge browser gate failed closed; no application assertion was converted to a skip.
- Sites-compatible vinext production build: reached Vite configuration loading and was blocked by the same spawn EPERM child-process policy before bundling. No source-level compiler failure was reported. Deployment was not attempted because this build did not complete.
- No OpenAI call, real travel transaction, payment, production deployment, raw screenshot persistence, or chain-of-thought disclosure occurred.

### Architecture records

ADR-0035 through ADR-0037 freeze the deterministic fatal eval, centralized command-risk classification, adversarial trust boundary, and real-browser CI policy.

### Phase boundary

Phase 9 is frozen. Phase 10, deployment, real-user authentication, credentialed model evaluation, and real travel execution remain blocked until explicit instruction.
## Entry 0045 - Phase 10 submission-grade README

- Date: 2026-07-15
- Phase: 10
- Status: Complete

The root README is rewritten as the Build Week submission front door. It opens with the five-second split-screen/mutation proof, preserves the Apps for Your Life track and synthetic travel boundary, and maps four first-class sections exactly to Technological Implementation, Design, Potential Impact, and Quality of the Idea.

The implementation section is grounded in the frozen source: `client.responses.create`, `gpt-5.6-sol`, high reasoning effort, bounded encrypted reasoning continuation, three explicit cache breakpoints, strict Structured Outputs plus Zod, client-owned Programmatic Tool Calling with `allowed_callers: ["programmatic"]`, application-managed Root / Perception / Adaptive Design / Planner / Critic routing, durable state replay, and server-side Codex Adapter Forge. The Forge description includes the actual no-network ephemeral workspace, one artifact path, three-attempt cap, independent AST / VM / unit / Playwright / axe / target gates, SHA-256 and Ed25519 publication, pgvector routing, and same-gates prebuilt fallback.

The Design section documents the recursive `AdaptiveUIManifest` compiler's topology, focus, cycle, reachability, profile-binding, semantic grammar, and typed-intent boundaries. Potential Impact cites the WHO 1.3-billion estimate while avoiding a market-size claim. Quality of the Idea frames user-edge intent compilation as the replacement for overlay-based task completion while explicitly preserving the need for standards, source remediation, usability research, and vendor accountability.

The README now includes live URL placeholders, architecture, security boundaries, frozen eval evidence, Node/Playwright prerequisites, clean-clone setup, narrow validation commands, two-terminal demo startup, live-mode requirements, repository topology, known limitations, and exact steps for the labelled deterministic judge replay. It does not present replay as live, claim WCAG certification, or claim a real transaction.

Current OpenAI terminology and fields were verified against the official GPT-5.6 model guidance, Programmatic Tool Calling guide, Responses multi-agent guide, GPT-5.6 Sol model page, and Codex SDK documentation. The WHO disability fact sheet is the source for the impact number. The official docs MCP endpoint could not be added because the managed Codex executable returned Access denied even after an approved escalation; direct official OpenAI pages were used as the documented fallback.

## Entry 0046 - Phase 10 video and Devpost assets

- Date: 2026-07-15
- Phase: 10
- Status: Complete

`docs/demo-script.md` is a 2:58 production plan with a recording truth contract, preflight, master timeline, exact screen direction, narration, edit notes, captions, word-count pacing, judging-criteria map, and go/no-go list. Its primary anchors match the directive exactly: 0:00 chaotic portal, 0:15 Observatory transformation, 0:45 adversarial Critic rejection, 1:20 source mutation and safe replan, and 2:20 R4 consent boundary.

The script makes the OpenAI contribution unavoidable and auditable. “GPT-5.6 Sol is the reasoning plane” must be spoken between 0:24 and 0:36 while the agent constellation is visible. “When vector routing cannot find a safe adapter, Codex becomes MORPH's repair engineer” must begin between 1:50 and 1:58 while Adapter Forge status is visible. Replay-specific narration explicitly says it is not a live model call.

The R4 shot is deliberately truth-preserving. The current replay selects a reversible fare and then shows the checked-in deterministic boundary evidence: SUBMIT, R4, reversible=false, REQUIRE_CONSENT, decision=PAUSE, executed=NO. It forbids a booking-complete claim. A real consent modal may replace that evidence card only when a live run actually emits the `CONSENT` manifest and `REQUIRE_CONSENT` event.

`docs/devpost-submission.md` provides paste-ready project name, tagline, elevator pitch, short summary, problem, product behavior, zero-to-one thesis, technical breakdown, five-role orchestration, browser verification, Codex Forge, durable evidence layer, demo, red-team boundary, exact eval results, challenges, accomplishments, lessons, roadmap, technology list, acknowledgements, and 100-character / 200-character / social variants. All submission links and license text remain visibly marked placeholders.

## Entry 0047 - Phase 10 validation and freeze

- Date: 2026-07-15
- Phase: 10
- Status: Complete; managed-host browser execution remains environment-blocked

### Commands

- official OpenAI documentation verification for GPT-5.6, Responses Programmatic Tool Calling, Multi-agent, and Codex SDK terminology
- documentation integrity audit for required headings, timestamps, mandatory narration phrases, Unicode integrity, placeholders, and local README links
- `npm run lint`
- `npm run typecheck`
- `npm run check`

### Results

- README: 272 lines; all four judging sections, setup, security, fallback, eval, limitations, and six local documentation links present.
- Demo script: 219 lines; all five exact timing anchors and both mandatory OpenAI narration lines present.
- Devpost copy: 205 lines; all production text-box sections and link placeholders present.
- UTF-8 replacement-character audit: passed for all three files.
- Local README link audit: 6 of 6 targets exist.
- Full ESLint: passed with zero warnings.
- Root TypeScript and all 11 workspace typechecks: passed.
- Full `npm run check`: lint, all typechecks, the 30-case fatal eval, orchestrator assertions, and Phase 9 eval/red-team assertions passed. Workspace testing then reached the unchanged managed-Windows boundary: Chromium launch, Vite real-path resolution, and Node default per-file workers failed only with child-process `spawn EPERM`. Adapter Forge failed closed; no mock, skip, or false-green condition was added.
- Phase 10 changes documentation only. Root Sites/vinext source, hosting configuration, schemas, runtime behavior, and dependency lock are unchanged.
- No deployment was attempted because the directive stops before Phase 11 and the local runner cannot complete the real Vite/Chromium release gates. GitHub CI remains the real Ubuntu/Chromium release authority.
- No OpenAI model call, Codex adapter generation, external message, real travel action, payment, secret write, raw reasoning disclosure, or personal-data persistence occurred.

### Architecture record

No ADR was added: Phase 10 packages the accepted architecture and changes no product, data, safety, execution, or deployment decision.

### Phase boundary

Phase 10 is complete and frozen. Live URL replacement, recording, upload, deployment, public publication, production credentials, and any Phase 11 work remain blocked until explicit instruction.