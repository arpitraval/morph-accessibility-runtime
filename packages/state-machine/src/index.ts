import {
  ACTION_OPERATION_CLASS,
  ALLOWED_RISK_CLASSES_BY_OPERATION,
  ActionStepSchema,
  AdaptiveExecutionIntentSchema,
  AgentEventSchema,
  type ActionStep,
  type AgentEvent,
  type TransitionReason,
  type WorkflowState,
} from "@morph/contracts";

export const MAX_REPLAN_ATTEMPTS = 3;

export const CORE_LIFECYCLE = Object.freeze([
  "CAPTURE",
  "NORMALIZE",
  "ROUTE",
  "PARALLEL_REASON",
  "COMPILE",
  "SIMULATE",
  "RISK_GATE",
  "EXECUTE_ONE_STEP",
  "VERIFY",
] as const satisfies readonly WorkflowState[]);

const TERMINAL_STATES = new Set<WorkflowState>(["COMPLETE", "STOP_SAFE"]);

export interface MachineSnapshot {
  readonly sessionId: string | null;
  readonly state: WorkflowState;
  readonly resumeState: WorkflowState | null;
  readonly replanAttempts: number;
  readonly lastSequence: number;
  readonly lastEventId: string | null;
  readonly eventCount: number;
  readonly terminal: boolean;
}

export type MachineSignal =
  | { readonly type: "STAGE_SUCCEEDED"; readonly detail: string }
  | {
      readonly type: "ACTION_READY";
      readonly actionStep: Pick<
        ActionStep,
        "id" | "pageVersion" | "command" | "riskClass" | "reversible" | "executionPolicy"
      >;
      readonly detail: string;
    }
  | { readonly type: "STEP_EXECUTED"; readonly detail: string }
  | { readonly type: "VERIFICATION_MATCH"; readonly hasNextStep: boolean; readonly detail: string }
  | { readonly type: "VERIFICATION_MISMATCH"; readonly detail: string }
  | {
      readonly type: "AMBIGUITY_DETECTED";
      readonly ambiguityIds: readonly string[];
      readonly question: string;
      readonly detail: string;
    }
  | {
      readonly type: "VERIFICATION_INCONCLUSIVE";
      readonly ambiguityIds: readonly string[];
      readonly question: string;
      readonly detail: string;
    }
  | { readonly type: "USER_INPUT_RECEIVED"; readonly detail: string }
  | { readonly type: "CONSENT_GRANTED"; readonly detail: string }
  | { readonly type: "CONSENT_DENIED"; readonly detail: string }
  | { readonly type: "FATAL_ERROR"; readonly detail: string };

export type TransitionHook =
  | {
      readonly type: "ASK_USER";
      readonly ambiguityIds: readonly string[];
      readonly question: string;
    }
  | {
      readonly type: "REQUIRE_CONSENT";
      readonly actionStepId: string;
      readonly pageVersion: number;
    };

export interface TransitionDecision {
  readonly from: WorkflowState;
  readonly to: WorkflowState;
  readonly reason: TransitionReason;
  readonly resumeState: WorkflowState | null;
  readonly detail: string;
  readonly replanAttemptsAfter: number;
  readonly hook: TransitionHook | null;
}

export interface TransitionEventEnvelope {
  readonly id: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly actor: Extract<AgentEvent["actor"], "ORCHESTRATOR" | "SAFETY_GOVERNOR" | "SYSTEM">;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly occurredAt: string;
}

export class InvalidEventLogError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidEventLogError";
  }
}

export class InvalidTransitionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

function assertReplayTransition(
  snapshot: MachineSnapshot,
  transition: Extract<AgentEvent, { type: "STATE_TRANSITIONED" }>["data"],
): void {
  if (snapshot.terminal) {
    throw new InvalidEventLogError("A terminal workflow cannot transition again.");
  }
  if (transition.from !== snapshot.state) {
    throw new InvalidEventLogError(
      `Transition expected state ${snapshot.state}, received from=${transition.from}.`,
    );
  }

  const { from, to, reason, resumeState } = transition;
  const normalEdges: Partial<Record<WorkflowState, WorkflowState>> = {
    CAPTURE: "NORMALIZE",
    NORMALIZE: "ROUTE",
    ROUTE: "PARALLEL_REASON",
    PARALLEL_REASON: "COMPILE",
    COMPILE: "SIMULATE",
    SIMULATE: "RISK_GATE",
    EXECUTE_ONE_STEP: "VERIFY",
  };

  if (normalEdges[from] === to && reason === (from === "EXECUTE_ONE_STEP" ? "STEP_EXECUTED" : "STAGE_SUCCEEDED")) {
    if (resumeState !== null) {
      throw new InvalidEventLogError("Ordinary lifecycle transitions cannot carry a resume state.");
    }
    return;
  }

  if (from === "RISK_GATE" && to === "EXECUTE_ONE_STEP" && reason === "STAGE_SUCCEEDED" && resumeState === null) {
    return;
  }
  if (
    from === "RISK_GATE" &&
    to === "REQUIRE_CONSENT" &&
    reason === "IRREVERSIBLE_ACTION" &&
    resumeState === "EXECUTE_ONE_STEP"
  ) {
    return;
  }
  if (
    from === "REQUIRE_CONSENT" &&
    to === "EXECUTE_ONE_STEP" &&
    reason === "CONSENT_GRANTED" &&
    resumeState === null
  ) {
    return;
  }
  if (from === "REQUIRE_CONSENT" && to === "STOP_SAFE" && reason === "CONSENT_DENIED" && resumeState === null) {
    return;
  }
  if (
    from === "VERIFY" &&
    to === "EXECUTE_ONE_STEP" &&
    reason === "VERIFICATION_MATCH_NEXT_STEP" &&
    resumeState === null
  ) {
    return;
  }
  if (
    from === "VERIFY" &&
    to === "COMPLETE" &&
    reason === "VERIFICATION_MATCH_COMPLETE" &&
    resumeState === null
  ) {
    return;
  }
  if (from === "VERIFY" && to === "CAPTURE" && reason === "VERIFICATION_MISMATCH" && resumeState === null) {
    if (snapshot.replanAttempts >= MAX_REPLAN_ATTEMPTS) {
      throw new InvalidEventLogError("The event log exceeds the three-attempt replan budget.");
    }
    return;
  }
  if (
    to === "ASK_USER" &&
    (reason === "AMBIGUITY_DETECTED" || reason === "VERIFICATION_INCONCLUSIVE") &&
    resumeState === from
  ) {
    return;
  }
  if (from === "ASK_USER" && to === snapshot.resumeState && reason === "USER_INPUT_RECEIVED" && resumeState === null) {
    return;
  }
  if (
    to === "STOP_SAFE" &&
    reason === "RETRY_EXHAUSTED" &&
    from === "VERIFY" &&
    snapshot.replanAttempts === MAX_REPLAN_ATTEMPTS &&
    resumeState === null
  ) {
    return;
  }
  if (to === "STOP_SAFE" && reason === "FATAL_ERROR" && resumeState === null) {
    return;
  }

  throw new InvalidEventLogError(`Illegal transition ${from} -> ${to} for reason ${reason}.`);
}

/**
 * Reconstructs all execution state from an ordered append-only event stream.
 * It accepts unknown values so validation cannot be accidentally skipped.
 */
export function replaySessionEvents(rawEvents: readonly unknown[]): MachineSnapshot {
  let snapshot: MachineSnapshot = {
    sessionId: null,
    state: "CAPTURE",
    resumeState: null,
    replanAttempts: 0,
    lastSequence: 0,
    lastEventId: null,
    eventCount: 0,
    terminal: false,
  };
  const eventIds = new Set<string>();
  const idempotencyKeys = new Set<string>();

  for (const [index, rawEvent] of rawEvents.entries()) {
    const parsed = AgentEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      throw new InvalidEventLogError(`Event at index ${index} failed schema validation: ${parsed.error.message}`);
    }
    const event = parsed.data;

    if (event.sequence !== snapshot.lastSequence + 1) {
      throw new InvalidEventLogError(
        `Session event sequence must be contiguous; expected ${snapshot.lastSequence + 1}, received ${event.sequence}.`,
      );
    }
    if (eventIds.has(event.id)) {
      throw new InvalidEventLogError(`Duplicate event id ${event.id}.`);
    }
    if (idempotencyKeys.has(event.idempotencyKey)) {
      throw new InvalidEventLogError(`Duplicate idempotency key ${event.idempotencyKey}.`);
    }
    if (snapshot.sessionId !== null && event.sessionId !== snapshot.sessionId) {
      throw new InvalidEventLogError("A replay batch cannot mix session ids.");
    }
    if (event.causationId !== null && !eventIds.has(event.causationId)) {
      throw new InvalidEventLogError("An event causation id must reference an earlier event in the same stream.");
    }
    if (index === 0 && event.type !== "SESSION_STARTED") {
      throw new InvalidEventLogError("The first session event must be SESSION_STARTED.");
    }
    if (index > 0 && event.type === "SESSION_STARTED") {
      throw new InvalidEventLogError("SESSION_STARTED may appear only once.");
    }

    if (event.type === "STATE_TRANSITIONED") {
      assertReplayTransition(snapshot, event.data);
      const isReplan =
        event.data.from === "VERIFY" &&
        event.data.to === "CAPTURE" &&
        event.data.reason === "VERIFICATION_MISMATCH";
      snapshot = {
        ...snapshot,
        state: event.data.to,
        resumeState: event.data.to === "ASK_USER" || event.data.to === "REQUIRE_CONSENT" ? event.data.resumeState : null,
        replanAttempts: snapshot.replanAttempts + (isReplan ? 1 : 0),
        terminal: TERMINAL_STATES.has(event.data.to),
      };
    }

    eventIds.add(event.id);
    idempotencyKeys.add(event.idempotencyKey);
    snapshot = {
      ...snapshot,
      sessionId: snapshot.sessionId ?? event.sessionId,
      lastSequence: event.sequence,
      lastEventId: event.id,
      eventCount: snapshot.eventCount + 1,
    };
  }

  return Object.freeze(snapshot);
}

function requireActiveSession(snapshot: MachineSnapshot): asserts snapshot is MachineSnapshot & { sessionId: string } {
  if (snapshot.sessionId === null) {
    throw new InvalidTransitionError("A SESSION_STARTED event is required before deciding a transition.");
  }
  if (snapshot.terminal) {
    throw new InvalidTransitionError(`Workflow is already terminal in ${snapshot.state}.`);
  }
}

function decision(
  snapshot: MachineSnapshot,
  to: WorkflowState,
  reason: TransitionReason,
  detail: string,
  resumeState: WorkflowState | null = null,
  hook: TransitionHook | null = null,
): TransitionDecision {
  if (detail.trim().length === 0) {
    throw new InvalidTransitionError("Transition detail must be non-empty.");
  }
  return Object.freeze({
    from: snapshot.state,
    to,
    reason,
    resumeState,
    detail,
    replanAttemptsAfter:
      snapshot.replanAttempts + (snapshot.state === "VERIFY" && to === "CAPTURE" ? 1 : 0),
    hook,
  });
}

/**
 * Pure command decider: every call replays the durable log and returns only the
 * next transition proposal. Callers append the proposal transactionally.
 */
export function decideNextTransition(rawEvents: readonly unknown[], signal: MachineSignal): TransitionDecision {
  const snapshot = replaySessionEvents(rawEvents);
  requireActiveSession(snapshot);

  if (signal.type === "FATAL_ERROR") {
    return decision(snapshot, "STOP_SAFE", "FATAL_ERROR", signal.detail);
  }


  if (snapshot.state === "ASK_USER") {
    if (signal.type !== "USER_INPUT_RECEIVED" || snapshot.resumeState === null) {
      throw new InvalidTransitionError("ASK_USER can resume only after USER_INPUT_RECEIVED.");
    }
    return decision(snapshot, snapshot.resumeState, "USER_INPUT_RECEIVED", signal.detail);
  }

  if (snapshot.state === "REQUIRE_CONSENT") {
    if (signal.type === "CONSENT_GRANTED") {
      return decision(snapshot, "EXECUTE_ONE_STEP", "CONSENT_GRANTED", signal.detail);
    }
    if (signal.type === "CONSENT_DENIED") {
      return decision(snapshot, "STOP_SAFE", "CONSENT_DENIED", signal.detail);
    }
    throw new InvalidTransitionError("REQUIRE_CONSENT accepts only an explicit grant or denial.");
  }

  if (signal.type === "AMBIGUITY_DETECTED" || signal.type === "VERIFICATION_INCONCLUSIVE") {
    if (signal.ambiguityIds.length === 0 || signal.question.trim().length === 0) {
      throw new InvalidTransitionError("ASK_USER requires a question and at least one ambiguity id.");
    }
    return decision(
      snapshot,
      "ASK_USER",
      signal.type === "AMBIGUITY_DETECTED" ? "AMBIGUITY_DETECTED" : "VERIFICATION_INCONCLUSIVE",
      signal.detail,
      snapshot.state,
      { type: "ASK_USER", ambiguityIds: signal.ambiguityIds, question: signal.question },
    );
  }

  if (signal.type === "STAGE_SUCCEEDED") {
    const nextByState: Partial<Record<WorkflowState, WorkflowState>> = {
      CAPTURE: "NORMALIZE",
      NORMALIZE: "ROUTE",
      ROUTE: "PARALLEL_REASON",
      PARALLEL_REASON: "COMPILE",
      COMPILE: "SIMULATE",
      SIMULATE: "RISK_GATE",
    };
    const next = nextByState[snapshot.state];
    if (next === undefined) {
      throw new InvalidTransitionError(`STAGE_SUCCEEDED is invalid while in ${snapshot.state}.`);
    }
    return decision(snapshot, next, "STAGE_SUCCEEDED", signal.detail);
  }

  if (signal.type === "ACTION_READY") {
    if (snapshot.state !== "RISK_GATE") {
      throw new InvalidTransitionError("ACTION_READY is valid only at RISK_GATE.");
    }
    const { actionStep } = signal;
    if (actionStep.riskClass === "RX" || actionStep.executionPolicy === "DENY") {
      return decision(snapshot, "STOP_SAFE", "FATAL_ERROR", "Safety policy denied the proposed action.");
    }
    const operationClass = ACTION_OPERATION_CLASS[actionStep.command.kind];
    const allowedRiskClasses = ALLOWED_RISK_CLASSES_BY_OPERATION[operationClass] as readonly string[];
    const invalidNonIrreversiblePolicy =
      operationClass !== "IRREVERSIBLE" &&
      (!actionStep.reversible || actionStep.executionPolicy !== "ALLOW_AFTER_SIMULATION");
    const invalidIrreversiblePolicy =
      operationClass === "IRREVERSIBLE" &&
      (actionStep.riskClass !== "R4" ||
        actionStep.reversible ||
        actionStep.executionPolicy !== "REQUIRE_CONSENT");
    if (
      !allowedRiskClasses.includes(actionStep.riskClass) ||
      invalidNonIrreversiblePolicy ||
      invalidIrreversiblePolicy
    ) {
      return decision(
        snapshot,
        "STOP_SAFE",
        "FATAL_ERROR",
        "Command, risk class, reversibility, and execution policy are inconsistent.",
      );
    }
    if (
      actionStep.riskClass === "R4" ||
      !actionStep.reversible ||
      actionStep.executionPolicy === "REQUIRE_CONSENT"
    ) {
      return decision(
        snapshot,
        "REQUIRE_CONSENT",
        "IRREVERSIBLE_ACTION",
        signal.detail,
        "EXECUTE_ONE_STEP",
        {
          type: "REQUIRE_CONSENT",
          actionStepId: actionStep.id,
          pageVersion: actionStep.pageVersion,
        },
      );
    }
    return decision(snapshot, "EXECUTE_ONE_STEP", "STAGE_SUCCEEDED", signal.detail);
  }

  if (signal.type === "STEP_EXECUTED") {
    if (snapshot.state !== "EXECUTE_ONE_STEP") {
      throw new InvalidTransitionError("STEP_EXECUTED is valid only at EXECUTE_ONE_STEP.");
    }
    return decision(snapshot, "VERIFY", "STEP_EXECUTED", signal.detail);
  }

  if (signal.type === "VERIFICATION_MATCH") {
    if (snapshot.state !== "VERIFY") {
      throw new InvalidTransitionError("VERIFICATION_MATCH is valid only at VERIFY.");
    }
    return signal.hasNextStep
      ? decision(snapshot, "EXECUTE_ONE_STEP", "VERIFICATION_MATCH_NEXT_STEP", signal.detail)
      : decision(snapshot, "COMPLETE", "VERIFICATION_MATCH_COMPLETE", signal.detail);
  }

  if (signal.type === "VERIFICATION_MISMATCH") {
    if (snapshot.state !== "VERIFY") {
      throw new InvalidTransitionError("VERIFICATION_MISMATCH is valid only at VERIFY.");
    }
    return snapshot.replanAttempts < MAX_REPLAN_ATTEMPTS
      ? decision(snapshot, "CAPTURE", "VERIFICATION_MISMATCH", signal.detail)
      : decision(snapshot, "STOP_SAFE", "RETRY_EXHAUSTED", signal.detail);
  }

  throw new InvalidTransitionError(`Signal ${signal.type} is invalid while in ${snapshot.state}.`);
}

/**
 * Validates the browser-facing UI command, binds it to the selected ActionStep,
 * and asks the existing risk gate for the only legal next transition.
 */
export function decideAdaptiveExecutionIntent(
  rawEvents: readonly unknown[],
  rawIntent: unknown,
  rawActionStep: unknown,
): TransitionDecision {
  const intent = AdaptiveExecutionIntentSchema.parse(rawIntent);
  const actionStep = ActionStepSchema.parse(rawActionStep);
  const snapshot = replaySessionEvents(rawEvents);
  requireActiveSession(snapshot);

  if (snapshot.sessionId !== intent.sessionId) {
    throw new InvalidTransitionError("Adaptive intent session does not match the durable event stream.");
  }
  if (snapshot.state !== intent.entryState) {
    throw new InvalidTransitionError(
      "Adaptive intent requires " + intent.entryState + "; durable state is " + snapshot.state + ".",
    );
  }
  if (actionStep.id !== intent.actionStepId) {
    throw new InvalidTransitionError("Adaptive intent is not bound to the supplied ActionStep.");
  }

  const firstEvent = AgentEventSchema.parse(rawEvents[0]);
  if (firstEvent.type !== "SESSION_STARTED" || firstEvent.data.accessProfileId !== intent.accessProfileId) {
    throw new InvalidTransitionError("Adaptive intent AccessProfile does not match the session.");
  }

  return decideNextTransition(rawEvents, {
    type: "ACTION_READY",
    actionStep,
    detail:
      "Validated adaptive component " +
      intent.componentId +
      " requested one risk-gated browser step from manifest " +
      intent.manifestId +
      ".",
  });
}

export function createTransitionEvent(
  envelope: TransitionEventEnvelope,
  transition: TransitionDecision,
): Extract<AgentEvent, { type: "STATE_TRANSITIONED" }> {
  const parsed = AgentEventSchema.parse({
    ...envelope,
    version: 1,
    type: "STATE_TRANSITIONED",
    data: {
      from: transition.from,
      to: transition.to,
      reason: transition.reason,
      resumeState: transition.resumeState,
      detail: transition.detail,
    },
  });
  if (parsed.type !== "STATE_TRANSITIONED") {
    throw new InvalidTransitionError("Transition event construction produced the wrong event variant.");
  }
  return parsed;
}

export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 2;
  readonly status: "implemented";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/state-machine",
  phase: 2,
  status: "implemented",
  responsibility: "Own event-replayed transitions, retry budgets, ambiguity pauses, consent guards, and terminal invariants.",
});
