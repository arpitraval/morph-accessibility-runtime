import assert from "node:assert/strict";
import test from "node:test";
import { ActionStepSchema, AdaptiveExecutionIntentSchema, AgentEventSchema, packageDescriptor } from "./index.js";

const validReversibleStep = {
  id: "00000000-0000-4000-8000-000000000101",
  ordinal: 1,
  targetNodeId: "flight-option-1",
  command: { kind: "SELECT", valueToken: "fixture-flight-1" },
  riskClass: "R2",
  reversible: true,
  executionPolicy: "ALLOW_AFTER_SIMULATION",
  preconditions: ["The option is visible and enabled."],
  expectedPostconditions: ["The option is selected."],
  evidenceRequirements: ["Fresh accessibility-tree selected state."],
  compensationCommand: { kind: "REMOVE_OPTION", optionToken: "fixture-flight-1" },
  idempotencyKey: "step-session-1-select-flight",
  pageVersion: 1,
} as const;

test("contracts publishes its Phase 2 schema boundary", () => {
  assert.equal(packageDescriptor.name, "@morph/contracts");
  assert.equal(packageDescriptor.phase, 2);
  assert.equal(packageDescriptor.status, "implemented");
});

test("ActionStep requires riskClass and reversible and rejects unknown keys", () => {
  assert.equal(ActionStepSchema.safeParse(validReversibleStep).success, true);
  const withoutRisk: Record<string, unknown> = { ...validReversibleStep };
  const withoutReversibility: Record<string, unknown> = { ...validReversibleStep };
  delete withoutRisk.riskClass;
  delete withoutReversibility.reversible;

  assert.equal(ActionStepSchema.safeParse(withoutRisk).success, false);
  assert.equal(ActionStepSchema.safeParse(withoutReversibility).success, false);
  assert.equal(ActionStepSchema.safeParse({ ...validReversibleStep, modelInstruction: "click everything" }).success, false);
});

test("ActionStep enforces irreversible and forbidden policy boundaries", () => {
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      command: { kind: "SUBMIT", formPurpose: "Confirm simulated booking" },
      riskClass: "R4",
      reversible: false,
      executionPolicy: "REQUIRE_CONSENT",
      compensationCommand: null,
    }).success,
    true,
  );
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      riskClass: "R4",
      reversible: true,
      executionPolicy: "ALLOW_AFTER_SIMULATION",
    }).success,
    false,
  );
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      riskClass: "RX",
      reversible: false,
      executionPolicy: "ALLOW_AFTER_SIMULATION",
    }).success,
    false,
  );
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      riskClass: "RX",
      reversible: false,
      executionPolicy: "DENY",
      compensationCommand: null,
    }).success,
    true,
  );
});

test("ActionStep rejects command-risk downgrades before the state machine", () => {
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      command: { kind: "SUBMIT", formPurpose: "Commit the booking" },
      riskClass: "R1",
      compensationCommand: null,
    }).success,
    false,
  );
  assert.equal(
    ActionStepSchema.safeParse({
      ...validReversibleStep,
      riskClass: "R1",
      compensationCommand: null,
    }).success,
    false,
  );
});
test("AgentEvent is a strict, versioned, sequenced envelope", () => {
  const event = {
    id: "00000000-0000-4000-8000-000000000201",
    sessionId: "00000000-0000-4000-8000-000000000202",
    sequence: 1,
    version: 1,
    type: "SESSION_STARTED",
    actor: "SYSTEM",
    idempotencyKey: "session-start-0001",
    correlationId: "00000000-0000-4000-8000-000000000203",
    causationId: null,
    occurredAt: "2026-07-14T12:00:00.000Z",
    data: {
      accessProfileId: "00000000-0000-4000-8000-000000000204",
      initialState: "CAPTURE",
    },
  } as const;

  assert.equal(AgentEventSchema.safeParse(event).success, true);
  assert.equal(AgentEventSchema.safeParse({ ...event, sequence: 0 }).success, false);
  assert.equal(AgentEventSchema.safeParse({ ...event, hiddenAuthority: true }).success, false);
});


test("AdaptiveExecutionIntent is closed and pinned to the risk gate", () => {
  const intent = {
    type: "ADAPTIVE_ACTION_REQUESTED",
    sessionId: "00000000-0000-4000-8000-000000000301",
    manifestId: "00000000-0000-4000-8000-000000000302",
    manifestVersion: 1,
    accessProfileId: "00000000-0000-4000-8000-000000000303",
    componentId: "flight-choice",
    actionStepId: "00000000-0000-4000-8000-000000000304",
    sourceNodeIds: ["flight-result-1"],
    entryState: "RISK_GATE",
    requestedState: "EXECUTE_ONE_STEP",
    target: "BROWSER_WORKER",
    idempotencyKey: "session:manifest:v1:step",
    occurredAt: "2026-07-14T12:00:00.000Z",
  } as const;

  assert.equal(AdaptiveExecutionIntentSchema.safeParse(intent).success, true);
  assert.equal(
    AdaptiveExecutionIntentSchema.safeParse({ ...intent, entryState: "EXECUTE_ONE_STEP" }).success,
    false,
  );
  assert.equal(AdaptiveExecutionIntentSchema.safeParse({ ...intent, bypassConsent: true }).success, false);
});