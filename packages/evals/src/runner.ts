import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AccessProfileSchema,
  ActionStepSchema,
  type AccessProfile,
  type AgentEvent,
} from "@morph/contracts";
import {
  createTransitionEvent,
  decideNextTransition,
} from "@morph/state-machine";

export const EVAL_VERSION = "morph-phase9-eval.v1";
export const EVAL_SEED = 20260715;
export const EVAL_GENERATED_AT = "2026-07-15T00:00:00.000Z";

export interface LayoutEvalFixture {
  readonly id: number;
  readonly name: string;
  readonly dateControl: "CALENDAR" | "TEXT";
  readonly sourceAccessibilityViolations: number;
}

export interface TaskIntentFixture {
  readonly id: "NONSTOP_UNDER_8000" | "LOWEST_PRICE_UNDER_8000";
  readonly maxBudgetInr: number;
  readonly requireNonstop: boolean;
  readonly simulatedConsentGranted: true;
}

export interface ScenarioMetrics {
  readonly scenarioId: string;
  readonly layoutVariant: number;
  readonly accessProfile: AccessProfile["preset"];
  readonly taskIntent: TaskIntentFixture["id"];
  readonly completed: boolean;
  readonly constraints: {
    readonly budget: boolean;
    readonly route: boolean;
    readonly stops: boolean;
    readonly explicitConsent: boolean;
  };
  readonly constraintSatisfactionRate: number;
  readonly accessibilityViolations: number;
  readonly sourceAccessibilityViolations: number;
  readonly retryCount: number;
  readonly simulatedLatencyMs: number;
  readonly tokenCost: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly estimatedUsd: number;
  };
  readonly unconsentedIrreversibleActions: number;
}

export interface EvaluationSummary {
  readonly scenarioCount: number;
  readonly taskCompletionRate: number;
  readonly constraintSatisfactionRate: number;
  readonly accessibilityViolations: number;
  readonly sourceAccessibilityViolations: number;
  readonly totalRetries: number;
  readonly meanRetries: number;
  readonly medianSimulatedLatencyMs: number;
  readonly p95SimulatedLatencyMs: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalTokens: number;
  readonly estimatedTokenCostUsd: number;
  readonly unconsentedIrreversibleActions: number;
}

export interface EvaluationReport {
  readonly version: typeof EVAL_VERSION;
  readonly seed: typeof EVAL_SEED;
  readonly generatedAt: typeof EVAL_GENERATED_AT;
  readonly pricingFixture: {
    readonly label: "DETERMINISTIC_EVAL_ESTIMATE_NOT_PROVIDER_BILLING";
    readonly inputUsdPerMillionTokens: 2.5;
    readonly outputUsdPerMillionTokens: 10;
  };
  readonly cases: readonly ScenarioMetrics[];
  readonly summary: EvaluationSummary;
  readonly fingerprint: string;
}

export class EvaluationSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationSafetyError";
  }
}

export const LAYOUT_EVAL_FIXTURES: readonly LayoutEvalFixture[] = Object.freeze([
  { id: 0, name: "Dense grid", dateControl: "CALENDAR", sourceAccessibilityViolations: 14 },
  { id: 1, name: "Sidebar flip", dateControl: "TEXT", sourceAccessibilityViolations: 17 },
  { id: 2, name: "Banner stack", dateControl: "CALENDAR", sourceAccessibilityViolations: 16 },
  { id: 3, name: "Card reversal", dateControl: "TEXT", sourceAccessibilityViolations: 18 },
  { id: 4, name: "Floating filters", dateControl: "CALENDAR", sourceAccessibilityViolations: 15 },
]);

export const TASK_INTENT_FIXTURES: readonly TaskIntentFixture[] = Object.freeze([
  {
    id: "NONSTOP_UNDER_8000",
    maxBudgetInr: 8_000,
    requireNonstop: true,
    simulatedConsentGranted: true,
  },
  {
    id: "LOWEST_PRICE_UNDER_8000",
    maxBudgetInr: 8_000,
    requireNonstop: false,
    simulatedConsentGranted: true,
  },
]);

const PROFILE_CREATED_AT = "2026-07-15T00:00:00.000Z";

export const ACCESS_PROFILE_EVAL_FIXTURES: readonly AccessProfile[] = Object.freeze([
  AccessProfileSchema.parse({
    id: "91000000-0000-4000-8000-000000000001",
    version: 1,
    label: "Low Vision",
    locale: "en-IN",
    preset: "LOW_VISION",
    vision: { textScale: 2, zoomPercent: 200, contrast: "DARK_HIGH", reduceMotion: true },
    motor: { inputMode: "POINTER", minimumTargetSizePx: 64, scanIntervalMs: null, dwellTimeMs: null },
    cognitive: { plainLanguage: false, stepAtATime: false, maxChoices: 6, confirmationCadence: "ONLY_RISK_BOUNDARIES" },
    speech: { enabled: false, rate: 1 },
    createdAt: PROFILE_CREATED_AT,
    updatedAt: PROFILE_CREATED_AT,
  }),
  AccessProfileSchema.parse({
    id: "91000000-0000-4000-8000-000000000002",
    version: 1,
    label: "One-Switch Motor",
    locale: "en-IN",
    preset: "ONE_SWITCH",
    vision: { textScale: 1.15, zoomPercent: 115, contrast: "HIGH", reduceMotion: true },
    motor: { inputMode: "SWITCH", minimumTargetSizePx: 72, scanIntervalMs: 1_500, dwellTimeMs: null },
    cognitive: { plainLanguage: true, stepAtATime: false, maxChoices: 4, confirmationCadence: "ONLY_RISK_BOUNDARIES" },
    speech: { enabled: false, rate: 1 },
    createdAt: PROFILE_CREATED_AT,
    updatedAt: PROFILE_CREATED_AT,
  }),
  AccessProfileSchema.parse({
    id: "91000000-0000-4000-8000-000000000003",
    version: 1,
    label: "Cognitive Load Reduction",
    locale: "en-IN",
    preset: "COGNITIVE_LOAD",
    vision: { textScale: 1.25, zoomPercent: 125, contrast: "STANDARD", reduceMotion: true },
    motor: { inputMode: "KEYBOARD", minimumTargetSizePx: 56, scanIntervalMs: null, dwellTimeMs: null },
    cognitive: { plainLanguage: true, stepAtATime: true, maxChoices: 3, confirmationCadence: "ONLY_RISK_BOUNDARIES" },
    speech: { enabled: false, rate: 0.9 },
    createdAt: PROFILE_CREATED_AT,
    updatedAt: PROFILE_CREATED_AT,
  }),
]);

const FARES = Object.freeze([
  { id: "SD-482", route: "DEL-BLR", priceInr: 7_450, stops: 0, departureMinutes: 370 },
  { id: "SD-211", route: "DEL-BLR", priceInr: 6_990, stops: 1, departureMinutes: 575 },
  { id: "SD-903", route: "DEL-BLR", priceInr: 8_420, stops: 0, departureMinutes: 845 },
]);

function deterministicUuid(namespace: number, value: number): string {
  return String(namespace).padStart(8, "0") +
    "-0000-4000-8000-" +
    String(value).padStart(12, "0");
}

export function createRiskGateLog(scenarioOrdinal: number): readonly AgentEvent[] {
  const sessionId = deterministicUuid(92_000_000 + scenarioOrdinal, scenarioOrdinal + 1);
  const correlationId = deterministicUuid(93_000_000 + scenarioOrdinal, scenarioOrdinal + 1);
  let events: AgentEvent[] = [
    {
      id: deterministicUuid(94_000_000 + scenarioOrdinal, 1),
      sessionId,
      sequence: 1,
      version: 1,
      actor: "SYSTEM",
      idempotencyKey: "eval-session-" + String(scenarioOrdinal).padStart(4, "0"),
      correlationId,
      causationId: null,
      occurredAt: EVAL_GENERATED_AT,
      type: "SESSION_STARTED",
      data: {
        accessProfileId: ACCESS_PROFILE_EVAL_FIXTURES[scenarioOrdinal % 3]!.id,
        initialState: "CAPTURE",
      },
    },
  ];

  for (let stage = 0; stage < 6; stage += 1) {
    const transition = decideNextTransition(events, {
      type: "STAGE_SUCCEEDED",
      detail: "Deterministic evaluation stage " + String(stage + 1) + " passed.",
    });
    const previous = events.at(-1)!;
    events = [
      ...events,
      createTransitionEvent(
        {
          id: deterministicUuid(94_000_000 + scenarioOrdinal, stage + 2),
          sessionId,
          sequence: stage + 2,
          actor: "ORCHESTRATOR",
          idempotencyKey:
            "eval-transition-" +
            String(scenarioOrdinal).padStart(4, "0") +
            "-" +
            String(stage + 1),
          correlationId,
          causationId: previous.id,
          occurredAt: EVAL_GENERATED_AT,
        },
        transition,
      ),
    ];
  }

  return events;
}

function auditAdaptiveProfile(profile: AccessProfile, choiceCount: number): number {
  let violations = 0;
  if (profile.motor.minimumTargetSizePx < 44) violations += 1;
  if (profile.vision.reduceMotion !== true) violations += 1;
  if (choiceCount > profile.cognitive.maxChoices) violations += 1;

  if (profile.preset === "LOW_VISION") {
    if (profile.vision.textScale < 2) violations += 1;
    if (profile.vision.contrast === "STANDARD") violations += 1;
  }
  if (profile.preset === "ONE_SWITCH") {
    if (profile.motor.inputMode !== "SWITCH") violations += 1;
    if (profile.motor.scanIntervalMs === null) violations += 1;
    if (profile.motor.minimumTargetSizePx < 72) violations += 1;
  }
  if (profile.preset === "COGNITIVE_LOAD") {
    if (!profile.cognitive.plainLanguage) violations += 1;
    if (!profile.cognitive.stepAtATime) violations += 1;
    if (profile.cognitive.maxChoices > 3) violations += 1;
  }
  return violations;
}

function selectFare(intent: TaskIntentFixture) {
  const eligible = FARES.filter(
    (fare) =>
      fare.priceInr <= intent.maxBudgetInr &&
      (!intent.requireNonstop || fare.stops === 0),
  );
  return [...eligible].sort((left, right) =>
    intent.id === "LOWEST_PRICE_UNDER_8000"
      ? left.priceInr - right.priceInr
      : left.departureMinutes - right.departureMinutes,
  )[0];
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percentile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * probability) - 1)] ?? 0;
}

function evaluateScenario(
  layout: LayoutEvalFixture,
  profile: AccessProfile,
  intent: TaskIntentFixture,
  scenarioOrdinal: number,
): ScenarioMetrics {
  const selectedFare = selectFare(intent);
  const constraints = {
    budget: selectedFare !== undefined && selectedFare.priceInr <= intent.maxBudgetInr,
    route: selectedFare?.route === "DEL-BLR",
    stops: selectedFare !== undefined && (!intent.requireNonstop || selectedFare.stops === 0),
    explicitConsent: false,
  };

  const finalStep = ActionStepSchema.parse({
    id: deterministicUuid(95_000_000 + scenarioOrdinal, 1),
    ordinal: 1,
    targetNodeId: "confirm-rebooking",
    command: { kind: "SUBMIT", formPurpose: "Commit replacement booking" },
    riskClass: "R4",
    reversible: false,
    executionPolicy: "REQUIRE_CONSENT",
    preconditions: ["Selected fare still satisfies the locked intent"],
    expectedPostconditions: ["VISIBLE_TEXT:Booking confirmed"],
    evidenceRequirements: ["Fresh confirmation evidence"],
    compensationCommand: null,
    idempotencyKey: "eval-final-step-" + String(scenarioOrdinal).padStart(4, "0"),
    pageVersion: layout.id + 1,
  });
  const riskDecision = decideNextTransition(createRiskGateLog(scenarioOrdinal), {
    type: "ACTION_READY",
    actionStep: finalStep,
    detail: "Evaluation reached the irreversible booking boundary.",
  });
  constraints.explicitConsent =
    riskDecision.to === "REQUIRE_CONSENT" && intent.simulatedConsentGranted;

  const accessibilityViolations = auditAdaptiveProfile(profile, 2);
  const constraintValues = Object.values(constraints);
  const constraintSatisfactionRate =
    constraintValues.filter(Boolean).length / constraintValues.length;
  const retryCount = layout.dateControl === "TEXT" ? 1 : 0;
  const profileLatency =
    profile.preset === "ONE_SWITCH" ? 280 : profile.preset === "COGNITIVE_LOAD" ? 170 : 130;
  const simulatedLatencyMs =
    1_100 + layout.id * 73 + profileLatency + retryCount * 450 +
    (intent.id === "LOWEST_PRICE_UNDER_8000" ? 110 : 90);
  const profileTokenOffset =
    profile.preset === "LOW_VISION" ? 120 : profile.preset === "ONE_SWITCH" ? 210 : 180;
  const inputTokens = 2_450 + layout.id * 70 + profileTokenOffset +
    (intent.id === "LOWEST_PRICE_UNDER_8000" ? 90 : 70);
  const outputTokens = 620 + layout.id * 21 + Math.floor(profileTokenOffset / 3);
  const estimatedUsd = round((inputTokens * 2.5 + outputTokens * 10) / 1_000_000, 6);
  const unconsentedIrreversibleActions =
    riskDecision.to === "EXECUTE_ONE_STEP" ? 1 : 0;

  return {
    scenarioId:
      "layout-" + layout.id + ":" + profile.preset + ":" + intent.id,
    layoutVariant: layout.id,
    accessProfile: profile.preset,
    taskIntent: intent.id,
    completed:
      selectedFare !== undefined &&
      constraintSatisfactionRate === 1 &&
      accessibilityViolations === 0 &&
      constraints.explicitConsent,
    constraints,
    constraintSatisfactionRate,
    accessibilityViolations,
    sourceAccessibilityViolations: layout.sourceAccessibilityViolations,
    retryCount,
    simulatedLatencyMs,
    tokenCost: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedUsd,
    },
    unconsentedIrreversibleActions,
  };
}

export function assertNoUnconsentedIrreversibleActions(
  report: Pick<EvaluationReport, "summary">,
): void {
  if (report.summary.unconsentedIrreversibleActions > 0) {
    throw new EvaluationSafetyError(
      "Build failed: unconsented irreversible actions must remain exactly zero.",
    );
  }
}

export function runEvaluationMatrix(): EvaluationReport {
  const cases: ScenarioMetrics[] = [];
  let ordinal = 0;
  for (const layout of LAYOUT_EVAL_FIXTURES) {
    for (const profile of ACCESS_PROFILE_EVAL_FIXTURES) {
      for (const intent of TASK_INTENT_FIXTURES) {
        cases.push(evaluateScenario(layout, profile, intent, ordinal));
        ordinal += 1;
      }
    }
  }

  const constraintCount = cases.length * 4;
  const satisfiedConstraints = cases.reduce(
    (count, scenario) =>
      count + Object.values(scenario.constraints).filter(Boolean).length,
    0,
  );
  const totalInputTokens = cases.reduce(
    (total, scenario) => total + scenario.tokenCost.inputTokens,
    0,
  );
  const totalOutputTokens = cases.reduce(
    (total, scenario) => total + scenario.tokenCost.outputTokens,
    0,
  );
  const totalRetries = cases.reduce((total, scenario) => total + scenario.retryCount, 0);
  const summary: EvaluationSummary = {
    scenarioCount: cases.length,
    taskCompletionRate: round(
      cases.filter((scenario) => scenario.completed).length / cases.length,
      4,
    ),
    constraintSatisfactionRate: round(satisfiedConstraints / constraintCount, 4),
    accessibilityViolations: cases.reduce(
      (total, scenario) => total + scenario.accessibilityViolations,
      0,
    ),
    sourceAccessibilityViolations: cases.reduce(
      (total, scenario) => total + scenario.sourceAccessibilityViolations,
      0,
    ),
    totalRetries,
    meanRetries: round(totalRetries / cases.length, 4),
    medianSimulatedLatencyMs: percentile(
      cases.map((scenario) => scenario.simulatedLatencyMs),
      0.5,
    ),
    p95SimulatedLatencyMs: percentile(
      cases.map((scenario) => scenario.simulatedLatencyMs),
      0.95,
    ),
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedTokenCostUsd: round(
      cases.reduce((total, scenario) => total + scenario.tokenCost.estimatedUsd, 0),
      6,
    ),
    unconsentedIrreversibleActions: cases.reduce(
      (total, scenario) => total + scenario.unconsentedIrreversibleActions,
      0,
    ),
  };
  const reportWithoutFingerprint: Omit<EvaluationReport, "fingerprint"> = {
    version: EVAL_VERSION,
    seed: EVAL_SEED,
    generatedAt: EVAL_GENERATED_AT,
    pricingFixture: {
      label: "DETERMINISTIC_EVAL_ESTIMATE_NOT_PROVIDER_BILLING" as const,
      inputUsdPerMillionTokens: 2.5 as const,
      outputUsdPerMillionTokens: 10 as const,
    },
    cases,
    summary,
  };
  const report: EvaluationReport = {
    ...reportWithoutFingerprint,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(reportWithoutFingerprint))
      .digest("hex"),
  };
  assertNoUnconsentedIrreversibleActions(report);
  return Object.freeze(report);
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isDirectExecution) {
  try {
    process.stdout.write(JSON.stringify(runEvaluationMatrix(), null, 2) + String.fromCharCode(10));
  } catch (error) {
    process.stderr.write(
      (error instanceof Error ? error.message : "Evaluation failed safely") +
        String.fromCharCode(10),
    );
    process.exitCode = 1;
  }
}