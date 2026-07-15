import assert from "node:assert/strict";
import test from "node:test";
import type { AgentEvent } from "@morph/contracts";
import {
  InvalidEventLogError,
  InvalidTransitionError,
  MAX_REPLAN_ATTEMPTS,
  createTransitionEvent,
  decideAdaptiveExecutionIntent,
  decideNextTransition,
  packageDescriptor,
  replaySessionEvents,
  type MachineSignal,
} from "./index.js";

const sessionId = "00000000-0000-4000-8000-000000000001";
const profileId = "00000000-0000-4000-8000-000000000002";
const correlationId = "00000000-0000-4000-8000-000000000003";

function uuid(sequence: number): string {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

function startedEvent(): AgentEvent {
  return {
    id: uuid(10),
    sessionId,
    sequence: 1,
    version: 1,
    type: "SESSION_STARTED",
    actor: "SYSTEM",
    idempotencyKey: "session-start-event-0001",
    correlationId,
    causationId: null,
    occurredAt: "2026-07-14T12:00:00.000Z",
    data: {
      accessProfileId: profileId,
      initialState: "CAPTURE",
    },
  };
}

function appendSignal(events: AgentEvent[], signal: MachineSignal): AgentEvent[] {
  const transition = decideNextTransition(events, signal);
  const sequence = events.length + 1;
  const previousEvent = events.at(-1);
  const event = createTransitionEvent(
    {
      id: uuid(10 + sequence),
      sessionId,
      sequence,
      actor: transition.to === "REQUIRE_CONSENT" ? "SAFETY_GOVERNOR" : "ORCHESTRATOR",
      idempotencyKey: `transition-event-${sequence.toString().padStart(4, "0")}`,
      correlationId,
      causationId: previousEvent?.id ?? null,
      occurredAt: "2026-07-14T12:00:00.000Z",
    },
    transition,
  );
  return [...events, event];
}

const reversibleAction = {
  id: "00000000-0000-4000-8000-000000000100",
  pageVersion: 1,
  command: { kind: "FOCUS" },
  riskClass: "R1",
  reversible: true,
  executionPolicy: "ALLOW_AFTER_SIMULATION",
} as const;

function driveCaptureToRiskGate(initialEvents: AgentEvent[]): AgentEvent[] {
  let events = initialEvents;
  for (let index = 0; index < 6; index += 1) {
    events = appendSignal(events, { type: "STAGE_SUCCEEDED", detail: `Stage ${index + 1} completed.` });
  }
  return events;
}

function driveCaptureToVerify(initialEvents: AgentEvent[]): AgentEvent[] {
  let events = driveCaptureToRiskGate(initialEvents);
  events = appendSignal(events, { type: "ACTION_READY", actionStep: reversibleAction, detail: "Action is reversible." });
  events = appendSignal(events, { type: "STEP_EXECUTED", detail: "One action step executed." });
  return events;
}

test("state-machine publishes its Phase 2 implementation boundary", () => {
  assert.equal(packageDescriptor.name, "@morph/state-machine");
  assert.equal(packageDescriptor.phase, 2);
  assert.equal(packageDescriptor.status, "implemented");
});

test("replays the complete deterministic lifecycle without in-memory state", () => {
  let events = driveCaptureToVerify([startedEvent()]);
  assert.equal(replaySessionEvents(events).state, "VERIFY");

  events = appendSignal(events, {
    type: "VERIFICATION_MATCH",
    hasNextStep: false,
    detail: "All expected postconditions match fresh evidence.",
  });

  const snapshot = replaySessionEvents(events);
  assert.equal(snapshot.state, "COMPLETE");
  assert.equal(snapshot.terminal, true);
  assert.equal(snapshot.replanAttempts, 0);
});

test("emits explicit ASK_USER and REQUIRE_CONSENT pause hooks", () => {
  let ambiguityEvents: AgentEvent[] = [startedEvent()];
  ambiguityEvents = appendSignal(ambiguityEvents, { type: "STAGE_SUCCEEDED", detail: "Capture completed." });
  const ask = decideNextTransition(ambiguityEvents, {
    type: "AMBIGUITY_DETECTED",
    ambiguityIds: ["00000000-0000-4000-8000-000000000200"],
    question: "Which flight should MORPH preserve?",
    detail: "The intent contains a blocking ambiguity.",
  });
  assert.deepEqual(ask.hook, {
    type: "ASK_USER",
    ambiguityIds: ["00000000-0000-4000-8000-000000000200"],
    question: "Which flight should MORPH preserve?",
  });
  ambiguityEvents = appendSignal(ambiguityEvents, {
    type: "AMBIGUITY_DETECTED",
    ambiguityIds: ["00000000-0000-4000-8000-000000000200"],
    question: "Which flight should MORPH preserve?",
    detail: "The intent contains a blocking ambiguity.",
  });
  assert.throws(
    () =>
      decideNextTransition(ambiguityEvents, {
        type: "AMBIGUITY_DETECTED",
        ambiguityIds: ["00000000-0000-4000-8000-000000000200"],
        question: "Nested pause is forbidden.",
        detail: "Attempt to nest an ambiguity pause.",
      }),
    InvalidTransitionError,
  );

  ambiguityEvents = appendSignal(ambiguityEvents, {
    type: "USER_INPUT_RECEIVED",
    detail: "The ambiguity was resolved.",
  });
  assert.equal(replaySessionEvents(ambiguityEvents).state, "NORMALIZE");

  let consentEvents = driveCaptureToRiskGate([startedEvent()]);
  const consent = decideNextTransition(consentEvents, {
    type: "ACTION_READY",
    actionStep: {
      id: "00000000-0000-4000-8000-000000000300",
      pageVersion: 1,
      command: { kind: "SUBMIT", formPurpose: "Commit replacement booking" },
      riskClass: "R4",
      reversible: false,
      executionPolicy: "REQUIRE_CONSENT",
    },
    detail: "The simulated booking submission is irreversible.",
  });
  assert.deepEqual(consent.hook, {
    type: "REQUIRE_CONSENT",
    actionStepId: "00000000-0000-4000-8000-000000000300",
    pageVersion: 1,
  });
  consentEvents = appendSignal(consentEvents, {
    type: "ACTION_READY",
    actionStep: {
      id: "00000000-0000-4000-8000-000000000300",
      pageVersion: 1,
      command: { kind: "SUBMIT", formPurpose: "Commit replacement booking" },
      riskClass: "R4",
      reversible: false,
      executionPolicy: "REQUIRE_CONSENT",
    },
    detail: "The simulated booking submission is irreversible.",
  });
  consentEvents = appendSignal(consentEvents, {
    type: "CONSENT_GRANTED",
    detail: "Fresh action-scoped consent was granted.",
  });
  assert.equal(replaySessionEvents(consentEvents).state, "EXECUTE_ONE_STEP");
});

test("risk gate stops a downgraded irreversible command", () => {
  const events = driveCaptureToRiskGate([startedEvent()]);
  const decision = decideNextTransition(events, {
    type: "ACTION_READY",
    actionStep: {
      id: "00000000-0000-4000-8000-000000000399",
      pageVersion: 1,
      command: { kind: "SUBMIT", formPurpose: "Injected booking submission" },
      riskClass: "R1",
      reversible: true,
      executionPolicy: "ALLOW_AFTER_SIMULATION",
    },
    detail: "Untrusted page text attempted to downgrade a submission.",
  });

  assert.equal(decision.to, "STOP_SAFE");
  assert.equal(decision.reason, "FATAL_ERROR");
});
test("permits exactly three verification replans and stops on the fourth mismatch", () => {
  let events = driveCaptureToVerify([startedEvent()]);

  for (let attempt = 1; attempt <= MAX_REPLAN_ATTEMPTS; attempt += 1) {
    const replan = decideNextTransition(events, {
      type: "VERIFICATION_MISMATCH",
      detail: `Fresh evidence mismatch ${attempt}.`,
    });
    assert.equal(replan.to, "CAPTURE");
    assert.equal(replan.replanAttemptsAfter, attempt);
    events = appendSignal(events, {
      type: "VERIFICATION_MISMATCH",
      detail: `Fresh evidence mismatch ${attempt}.`,
    });
    events = driveCaptureToVerify(events);
  }

  const stop = decideNextTransition(events, {
    type: "VERIFICATION_MISMATCH",
    detail: "Fresh evidence still mismatches after three replans.",
  });
  assert.equal(stop.to, "STOP_SAFE");
  assert.equal(stop.reason, "RETRY_EXHAUSTED");
  assert.equal(stop.replanAttemptsAfter, MAX_REPLAN_ATTEMPTS);

  events = appendSignal(events, {
    type: "VERIFICATION_MISMATCH",
    detail: "Fresh evidence still mismatches after three replans.",
  });
  assert.equal(replaySessionEvents(events).state, "STOP_SAFE");
});

test("rejects gaps and illegal transitions in the durable log", () => {
  assert.throws(
    () => replaySessionEvents([{ ...startedEvent(), sequence: 2 }]),
    InvalidEventLogError,
  );

  const illegal = createTransitionEvent(
    {
      id: uuid(11),
      sessionId,
      sequence: 2,
      actor: "ORCHESTRATOR",
      idempotencyKey: "illegal-transition-0002",
      correlationId,
      causationId: uuid(10),
      occurredAt: "2026-07-14T12:00:00.000Z",
    },
    {
      from: "CAPTURE",
      to: "VERIFY",
      reason: "STAGE_SUCCEEDED",
      resumeState: null,
      detail: "Attempt to skip required states.",
      replanAttemptsAfter: 0,
      hook: null,
    },
  );

  assert.throws(
    () => replaySessionEvents([startedEvent(), illegal]),
    InvalidEventLogError,
  );
});


test("routes a closed adaptive UI intent through RISK_GATE", () => {
  const events = driveCaptureToRiskGate([startedEvent()]);
  const actionStep = {
    id: reversibleAction.id,
    ordinal: 1,
    targetNodeId: "flight-option-1",
    command: { kind: "FOCUS" },
    riskClass: reversibleAction.riskClass,
    reversible: reversibleAction.reversible,
    executionPolicy: reversibleAction.executionPolicy,
    preconditions: ["The target is visible."],
    expectedPostconditions: ["The target receives focus."],
    evidenceRequirements: ["Fresh accessibility-tree focus evidence."],
    compensationCommand: null,
    idempotencyKey: "adaptive-step-focus-flight-1",
    pageVersion: reversibleAction.pageVersion,
  } as const;
  const intent = {
    type: "ADAPTIVE_ACTION_REQUESTED",
    sessionId,
    manifestId: "00000000-0000-4000-8000-000000000401",
    manifestVersion: 1,
    accessProfileId: profileId,
    componentId: "flight-choice",
    actionStepId: actionStep.id,
    sourceNodeIds: ["flight-option-1"],
    entryState: "RISK_GATE",
    requestedState: "EXECUTE_ONE_STEP",
    target: "BROWSER_WORKER",
    idempotencyKey: "adaptive-intent-session-step-1",
    occurredAt: "2026-07-14T12:00:00.000Z",
  } as const;

  const decision = decideAdaptiveExecutionIntent(events, intent, actionStep);
  assert.equal(decision.from, "RISK_GATE");
  assert.equal(decision.to, "EXECUTE_ONE_STEP");
  assert.equal(decision.hook, null);

  assert.throws(
    () =>
      decideAdaptiveExecutionIntent(
        events,
        { ...intent, actionStepId: "00000000-0000-4000-8000-000000000499" },
        actionStep,
      ),
    InvalidTransitionError,
  );
});