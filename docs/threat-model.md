# MORPH threat model

- Status: **FROZEN baseline v0.1**
- Method: asset and trust-boundary analysis with abuse cases
- Highest-risk capability: executing actions in an untrusted interface on a user's behalf

## 1. Protected assets

- user intent, constraints, and access profile
- session observations and screenshots
- authentication sessions and browser cookies
- model and service credentials
- consent records
- target-interface state
- adapter source, tests, and artifact signatures
- event-log integrity
- fixture and future real-world action idempotency

## 2. Trust boundaries

1. User input to MORPH ingress
2. Untrusted target page to observation pipeline
3. Application state to model request
4. Model output to schema and policy validator
5. Planner output to browser executor
6. Browser executor to external side effect
7. Consent UI to irreversible action gate
8. Adapter Forge input to Codex sandbox
9. Tested adapter artifact to registry
10. Durable event store to streamed UI

No data crossing a boundary inherits authority from its source.

## 3. Action classes

| Class | Examples | Default policy |
| --- | --- | --- |
| R0 Observe | screenshot, DOM read, accessibility-tree read | allow and redact |
| R1 Local reversible | focus, expand, select in fixture | allow one step, then verify |
| R2 External reversible | add/remove fixture option, navigate workflow | require simulation, idempotency, then verify |
| R3 Sensitive preparation | enter identity or contact data | explicit purpose and field-level disclosure |
| R4 Irreversible | purchase, submit, send, delete, legally bind | fresh accessible consent for one exact action |
| RX Forbidden | bypass auth, expose secrets, evade consent, arbitrary code | deny |

The Build Week fixture uses R0-R2 and one simulated R4 booking. It never accepts real payment credentials.

## 4. Primary threats and controls

### T-001 ? Indirect prompt injection

Threat: visible or hidden page content tells the model to ignore policy, reveal secrets, call tools, or change the user's goal.

Controls:

- wrap page content as untrusted evidence
- keep system policy and user intent outside retrieved page text
- use closed output schemas
- allowlist tools by state and agent role
- prevent page content from changing tool descriptions or risk classes
- test visible, hidden, encoded, and accessibility-tree-only injection

### T-002 ? Confused-deputy action

Threat: the planner uses MORPH's authority to perform an action the user did not request.

Controls:

- bind every action to an IntentGraph constraint and evidence requirement
- deny actions without a traceable goal edge
- show action consequence before consent
- use one-action consent tokens with page-version binding

### T-003 ? Stale state and duplicate execution

Threat: the target changes between planning and action, or a retry repeats a side effect.

Controls:

- page-version and state hashes
- precondition checks immediately before execution
- idempotency keys
- one-step execution
- post-action observation before any retry
- expired plans and consent on relevant state change

### T-004 ? False verification

Threat: the executor or model claims success without matching source evidence.

Controls:

- independent verifier
- evidence from fresh observation
- typed expected postconditions
- target and adaptive state comparison
- no success state without stored verification event

### T-005 ? Consent dark patterns

Threat: confirmation is inaccessible, vague, bundled, or preselected.

Controls:

- exact action, date, price, passenger, and consequence
- neutral confirm and cancel ordering
- no countdown
- compatible one-switch and keyboard path
- consent expires on material state change

### T-006 ? Sensitive-data leakage

Threat: screenshots, speech, cookies, personal fields, or secrets enter logs, prompts, URLs, traces, or adapters.

Controls:

- field- and region-level redaction before persistence
- credential isolation in the browser worker
- structured safe telemetry allowlist
- no raw screenshot retention by default
- no secret values in client bundles or logs
- adapter fixtures contain synthetic data only

### T-007 ? Malicious generated adapter

Threat: generated code exfiltrates data, expands network access, hides behavior, or bypasses the safety governor.

Controls:

- ephemeral restricted workspace
- fixed adapter interface and dependency allowlist
- no production credentials in the forge
- static analysis, unit, browser, accessibility, and policy tests
- artifact hash, provenance, quarantine, and manual promotion option
- adapters propose typed actions but cannot authorize them

### T-008 ? Model/tool denial of service

Threat: cyclic replanning, huge screenshots, tool storms, or malicious pages exhaust latency and budget.

Controls:

- maximum three replans
- per-state token, time, and tool budgets
- bounded image regions and original detail only when needed
- circuit breakers and cancellation
- no unbounded agent tree

### T-009 ? Vector-memory poisoning

Threat: a failed or malicious trace becomes a preferred adapter.

Controls:

- only independently verified traces are eligible
- success and safety penalties
- minimum evidence and test thresholds
- versioned rollback
- retrieval never grants execution authority

### T-010 ? Replay deception

Threat: a deterministic trace is presented as a live model run.

Controls:

- immutable live/replay session mode
- visible badge in the UI and telemetry
- README and video disclosure
- replay artifacts contain source trace metadata

## 5. Browser isolation contract

The browser worker owns target cookies and credentials. The orchestrator receives redacted observations and typed action results, not raw cookie stores. The target page cannot access MORPH secrets, internal APIs, host files, or adapter source. New origins are denied unless the session policy explicitly allows them.

## 6. Logging and retention

Allowed telemetry:

- state and event identifiers
- agent role and status
- tool name and duration
- redacted evidence references
- schema validation outcomes
- risk class
- verification result
- token and latency totals

Disallowed by default:

- raw speech
- raw screenshots
- browser cookies
- authentication headers
- payment details
- personal identifiers
- private model reasoning
- unrestricted DOM dumps

## 7. Residual risks

- Visual and semantic ambiguity can still produce incorrect plans.
- Third-party sites can change faster than adapters are validated.
- Accessibility needs are individual and cannot be fully represented by three presets.
- Automated accessibility tests cannot prove complete usability.
- Computer-use actions remain probabilistic and require strong containment.

These risks require transparent limitations, user control, safe stopping, and testing with people who use assistive technology before any real-world deployment.

## 8. Security acceptance gate

Before any non-fixture target is enabled, MORPH must demonstrate:

- zero unconsented R4 actions across the full adversarial suite
- prompt-injection isolation
- idempotent retry behavior
- consent invalidation on state mutation
- credential and cookie isolation
- redacted logs and traces
- adapter sandbox escape resistance appropriate to the deployment environment
