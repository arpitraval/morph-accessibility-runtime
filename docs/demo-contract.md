# MORPH three-minute demo contract

- Status: **FROZEN for Build Week v0.1**
- Maximum duration: 2 minutes 55 seconds, leaving upload tolerance
- Scenario: disrupted travel rebooking
- Mandatory profiles: one-switch motor access and low vision
- Optional closing profile: cognitive-load reduction

## 1. Demo truth contract

The submitted video must show a working local or deployed build. Live model calls and deterministic replay must be visibly labelled. Edited time may remove waiting, but it may not imply that a replayed trace is live or that an irreversible action occurred when it did not.

The target travel portal uses deterministic sample data and no real passenger, payment, or booking system. The final action records a fixture booking only after explicit consent.

## 2. Starting state

The demo opens in a split view:

- left: the intentionally inaccessible source portal
- center: the MORPH adaptive surface
- right: the Agent Observatory with state, evidence, agents, and constraints

Default access profile: one-switch motor access.

Default intent:

> Move tomorrow's disrupted journey to an option below INR 8,000. Do not purchase without my confirmation.

Visible constraint ledger:

- date: tomorrow
- ceiling: INR 8,000
- passenger: unchanged
- add-ons: none unless requested
- purchase: explicit confirmation required

## 3. Timed storyboard

### 0:00-0:12 ? Hook

Show the dense source portal and the one-switch profile. Speak the goal. The center surface must visibly contract into no more than three large choices.

Narration target: "The web asks every body to adapt to every interface. MORPH reverses that."

### 0:12-0:42 ? Multimodal compilation

Show the SurfaceGraph evidence sources arriving: screenshot, DOM, accessibility tree, and profile constraints. The Agent Observatory displays bounded perception, adaptive-design, planning, and critic workstreams.

The interface shows concise conclusions and evidence, not chain-of-thought.

### 0:42-1:12 ? Constraint-aware planning

Show at least two candidate travel options. The critic rejects one that exceeds the price ceiling or includes an add-on. The adaptive surface presents the remaining safe choices in the one-switch scan order.

### 1:12-1:42 ? Source mutation and recovery

Activate `Mutate source UI`. The fixture changes layout, labels, and DOM ordering while retaining its semantic task. A previously prepared selector or assumption becomes stale.

MORPH must:

1. detect that observed state does not match the expected postcondition,
2. invalidate the stale plan,
3. preserve the user's intent and constraints,
4. re-observe and replan,
5. continue without an unsafe duplicate action.

This is the mandatory self-correction moment.

### 1:42-2:12 ? Consent boundary

Reach the fixture's final booking action. MORPH displays exact journey, date, price, passenger, and consequence. The final action remains blocked until the single-switch confirmation reaches the explicit confirm control.

Show that changing the source price or date expires existing consent.

### 2:12-2:35 ? Verified completion

After consent, execute once. Show fresh source evidence, a successful independent verification, the fixture booking identifier, and an audit event. The source portal and adaptive surface must agree.

### 2:35-2:55 ? Universal adaptation close

Switch to the low-vision profile. The same completed intent state remains, while typography, contrast, density, and interaction treatment change. Close on:

> 1.3 billion people should not have to wait for every application to adapt.

## 4. Mandatory visual signals

- a state-machine progress rail
- four bounded agent nodes with current status
- a visible constraint ledger
- live versus replay badge
- expected versus observed verification evidence
- a clear rejected-plan moment
- a clear source-mutation moment
- a clear consent gate
- a verified-complete state
- no decorative terminal windows in the primary demo

## 5. Fixture requirements

The travel portal must provide:

- at least five seeded layout/DOM variants
- stable semantic fixture identifiers unavailable to the model
- fares both above and below the price ceiling
- an optional add-on trap
- a date-change trap
- a stale-state mutation endpoint
- an idempotent fixture booking endpoint
- deterministic reset and seed controls

A variant is selected before the run and recorded in the session event stream. The model receives only the same user-visible and browser-observable evidence available at runtime.

## 6. Go/no-go acceptance criteria

The recording may proceed only when:

- the complete scenario passes three consecutive clean resets
- the mutation recovery succeeds without manual correction
- no irreversible fixture action occurs before fresh consent
- the final source state and adaptive state match
- keyboard and one-switch paths both complete
- browser refresh reconstructs the visible session
- secrets, raw private reasoning, and personal data are absent
- the production build passes
- the README clean-start instructions have been tested

## 7. Fallback policy

A labelled replay trace may be used for judge setup and offline exploration. The primary video should show a live Sol run when account access and network reliability permit. If the live run is unavailable, the video must state that the trace is a replay captured from the same build and must still demonstrate deterministic state transitions and browser fixture execution.

## 8. Submission evidence

The repository README and Devpost description must identify:

- where Codex accelerated architecture and implementation
- where GPT-5.6 Sol performs essential runtime work
- which safety decisions remain deterministic
- how to reproduce the demo
- how to reset fixture data
- how to enable live or replay mode
- the limitations and non-goals
