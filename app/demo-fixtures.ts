import {
  AccessProfileSchema,
  AdaptiveUIManifestSchema,
  ObservatoryEventSchema,
  type AccessProfile,
  type AdaptiveUIManifest,
  type ObservatoryEvent,
} from "../packages/contracts/src/index.js";
import type { AdaptiveProfileKey } from "../packages/accessibility-kit/src/components.js";

export const DEMO_SESSION_ID = "10000000-0000-4000-8000-000000000001";
const SURFACE_GRAPH_ID = "10000000-0000-4000-8000-000000000002";
const INTENT_GRAPH_ID = "10000000-0000-4000-8000-000000000003";
const GENERATED_AT = "2026-07-14T12:00:00.000Z";

function component(
  id: string,
  kind: AdaptiveUIManifest["components"][number]["kind"],
  order: number,
  label: string,
  description: string | null,
  importance: AdaptiveUIManifest["components"][number]["importance"],
  actionStepId: string | null = null,
  parentId: string | null = null,
): AdaptiveUIManifest["components"][number] {
  return {
    id,
    kind,
    parentId,
    order,
    label,
    description,
    sourceNodeIds: ["flight-results"],
    actionStepId,
    importance,
    enabled: true,
  };
}

function manifest(
  id: string,
  accessProfileId: string,
  title: string,
  announcement: string,
  components: AdaptiveUIManifest["components"],
): AdaptiveUIManifest {
  const fixture = {
    id,
    sessionId: DEMO_SESSION_ID,
    accessProfileId,
    surfaceGraphId: SURFACE_GRAPH_ID,
    intentGraphId: INTENT_GRAPH_ID,
    version: 1,
    title,
    announcement,
    rootComponentIds: components.filter((item) => item.parentId === null).map((item) => item.id),
    components,
    focusOrder: components
      .filter((item) => item.enabled && (item.kind === "ACTION" || item.kind === "CHOICE" || item.kind === "CONSENT"))
      .map((item) => item.id),
    generatedAt: GENERATED_AT,
  };

  return AdaptiveUIManifestSchema.parse(fixture);
}

const lowVisionProfile = AccessProfileSchema.parse({
  id: "21000000-0000-4000-8000-000000000001",
  version: 1,
  label: "Low Vision",
  locale: "en-IN",
  preset: "LOW_VISION",
  vision: { textScale: 2, zoomPercent: 200, contrast: "DARK_HIGH", reduceMotion: true },
  motor: {
    inputMode: "POINTER",
    minimumTargetSizePx: 64,
    scanIntervalMs: null,
    dwellTimeMs: null,
  },
  cognitive: {
    plainLanguage: false,
    stepAtATime: false,
    maxChoices: 6,
    confirmationCadence: "ONLY_RISK_BOUNDARIES",
  },
  speech: { enabled: false, rate: 1 },
  createdAt: GENERATED_AT,
  updatedAt: GENERATED_AT,
});

const oneSwitchProfile = AccessProfileSchema.parse({
  id: "21000000-0000-4000-8000-000000000002",
  version: 1,
  label: "One-Switch Motor",
  locale: "en-IN",
  preset: "ONE_SWITCH",
  vision: { textScale: 1.15, zoomPercent: 115, contrast: "HIGH", reduceMotion: true },
  motor: {
    inputMode: "SWITCH",
    minimumTargetSizePx: 72,
    scanIntervalMs: 1_500,
    dwellTimeMs: null,
  },
  cognitive: {
    plainLanguage: true,
    stepAtATime: false,
    maxChoices: 4,
    confirmationCadence: "ONLY_RISK_BOUNDARIES",
  },
  speech: { enabled: false, rate: 1 },
  createdAt: GENERATED_AT,
  updatedAt: GENERATED_AT,
});

const cognitiveProfile = AccessProfileSchema.parse({
  id: "21000000-0000-4000-8000-000000000003",
  version: 1,
  label: "Cognitive Load Reduction",
  locale: "en-IN",
  preset: "COGNITIVE_LOAD",
  vision: { textScale: 1.25, zoomPercent: 125, contrast: "STANDARD", reduceMotion: true },
  motor: {
    inputMode: "KEYBOARD",
    minimumTargetSizePx: 56,
    scanIntervalMs: null,
    dwellTimeMs: null,
  },
  cognitive: {
    plainLanguage: true,
    stepAtATime: true,
    maxChoices: 3,
    confirmationCadence: "ONLY_RISK_BOUNDARIES",
  },
  speech: { enabled: false, rate: 0.9 },
  createdAt: GENERATED_AT,
  updatedAt: GENERATED_AT,
});

const lowVisionManifest = manifest(
  "20000000-0000-4000-8000-000000000001",
  lowVisionProfile.id,
  "Two safe flights found",
  "Large text and high contrast are active. Prices include the fixture total.",
  [
    component("lv-heading", "HEADING", 0, "Tomorrow \u2192 Delhi to Bengaluru", null, "CONTEXT"),
    component(
      "lv-status",
      "STATUS",
      1,
      "2 options meet every constraint",
      "Non-stop, below \u20B98,000, passenger unchanged, no add-ons.",
      "PRIMARY",
    ),
    component(
      "lv-flight-1",
      "CHOICE",
      2,
      "06:10 SkyDash | \u20B97,450",
      "Non-stop | arrives 08:20 | exact total",
      "PRIMARY",
      "30000000-0000-4000-8000-000000000001",
    ),
    component(
      "lv-flight-2",
      "CHOICE",
      3,
      "09:35 CloudJet | \u20B96,990",
      "One stop | arrives 13:45 | exact total",
      "SECONDARY",
      "30000000-0000-4000-8000-000000000002",
    ),
    component(
      "lv-summary",
      "SUMMARY",
      4,
      "Nothing will be purchased yet",
      "MORPH will ask for a separate confirmation before the final booking action.",
      "CONTEXT",
    ),
  ],
);

const oneSwitchManifest = manifest(
  "20000000-0000-4000-8000-000000000002",
  oneSwitchProfile.id,
  "Choose one safe flight",
  "Single-switch automatic scan is active. Three sequential stops.",
  [
    component(
      "sw-status",
      "STATUS",
      0,
      "Scan stop 1 of 3",
      "The highlighted control can be selected with one switch.",
      "PRIMARY",
    ),
    component(
      "sw-flight-1",
      "CHOICE",
      1,
      "SkyDash | 06:10 | \u20B97,450",
      "Non-stop | arrives 08:20",
      "PRIMARY",
      "30000000-0000-4000-8000-000000000001",
    ),
    component(
      "sw-flight-2",
      "CHOICE",
      2,
      "CloudJet | 09:35 | \u20B96,990",
      "One stop | arrives 13:45",
      "SECONDARY",
      "30000000-0000-4000-8000-000000000002",
    ),
    component(
      "sw-back",
      "ACTION",
      3,
      "Keep my original journey",
      "Return without changing anything.",
      "CONTEXT",
      "30000000-0000-4000-8000-000000000003",
    ),
  ],
);

const cognitiveManifest = manifest(
  "20000000-0000-4000-8000-000000000003",
  cognitiveProfile.id,
  "Your next step",
  "Only the information needed for this decision is shown.",
  [
    component(
      "cg-heading",
      "HEADING",
      0,
      "Pick a replacement flight",
      "Both choices keep your date, passenger, and budget.",
      "PRIMARY",
    ),
    component(
      "cg-options",
      "GROUP",
      1,
      "Safe options",
      "Two plain-language choices.",
      "PRIMARY",
    ),
    component(
      "cg-flight-1",
      "CHOICE",
      0,
      "Earlier arrival",
      "SkyDash | 06:10 to 08:20 | \u20B97,450 | non-stop",
      "PRIMARY",
      "30000000-0000-4000-8000-000000000001",
      "cg-options",
    ),
    component(
      "cg-flight-2",
      "CHOICE",
      1,
      "Lower price",
      "CloudJet | 09:35 to 13:45 | \u20B96,990 | one stop",
      "SECONDARY",
      "30000000-0000-4000-8000-000000000002",
      "cg-options",
    ),
    component(
      "cg-summary",
      "SUMMARY",
      2,
      "You can review before confirming",
      "Selecting a flight does not purchase it.",
      "CONTEXT",
    ),
  ],
);

export interface ProfileFixture {
  readonly key: AdaptiveProfileKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly cue: string;
  readonly accessProfile: AccessProfile;
  readonly manifest: AdaptiveUIManifest;
}

export const PROFILE_FIXTURES: readonly ProfileFixture[] = Object.freeze([
  {
    key: "low-vision",
    label: "Low Vision",
    shortLabel: "Vision",
    cue: "High contrast | 200% type",
    accessProfile: lowVisionProfile,
    manifest: lowVisionManifest,
  },
  {
    key: "one-switch",
    label: "One-Switch Motor",
    shortLabel: "Switch",
    cue: "3-stop deterministic scan",
    accessProfile: oneSwitchProfile,
    manifest: oneSwitchManifest,
  },
  {
    key: "cognitive-load",
    label: "Cognitive Load Reduction",
    shortLabel: "Cognitive",
    cue: "Plain language | \u22643 choices",
    accessProfile: cognitiveProfile,
    manifest: cognitiveManifest,
  },
]);

export const CONSTRAINT_FIXTURES = Object.freeze([
  { label: "Budget", value: "Under \u20B98,000", state: "locked" },
  { label: "Route", value: "DEL \u2192 BLR", state: "locked" },
  { label: "Stops", value: "No layovers preferred", state: "watch" },
  { label: "Passenger", value: "Unchanged", state: "locked" },
  { label: "Add-ons", value: "None unless requested", state: "locked" },
  { label: "Purchase", value: "Explicit consent", state: "guarded" },
] as const);

function replayEvent(
  sequence: number,
  kind: ObservatoryEvent["kind"],
  data: unknown,
): ObservatoryEvent {
  const eventId = "40000000-0000-4000-8000-" + String(sequence).padStart(12, "0");
  return ObservatoryEventSchema.parse({
    sessionId: DEMO_SESSION_ID,
    sequence,
    eventId,
    occurredAt: new Date(Date.parse("2026-07-15T10:00:00.000Z") + sequence * 500).toISOString(),
    redaction: { reasoningExcluded: true, rawModelOutputExcluded: true },
    kind,
    data,
  });
}

export const OBSERVATORY_REPLAY_EVENTS: readonly ObservatoryEvent[] = Object.freeze([
  replayEvent(1, "STATE_TRANSITION", {
    from: "CAPTURE",
    to: "NORMALIZE",
    reason: "STAGE_SUCCEEDED",
    detail: "Fresh DOM and accessibility evidence captured.",
  }),
  replayEvent(2, "AGENT_ACTIVITY", {
    agent: "PERCEPTION",
    status: "SUCCEEDED",
    toolName: null,
    summary: "37 controls reduced to 11 task-relevant nodes.",
    evidenceIds: [],
  }),
  replayEvent(3, "STATE_TRANSITION", {
    from: "NORMALIZE",
    to: "ROUTE",
    reason: "STAGE_SUCCEEDED",
    detail: "Untrusted page data normalized into the closed SurfaceGraph.",
  }),
  replayEvent(4, "STATE_TRANSITION", {
    from: "ROUTE",
    to: "PARALLEL_REASON",
    reason: "STAGE_SUCCEEDED",
    detail: "Four bounded specialists received schema-scoped work.",
  }),
  replayEvent(5, "AGENT_ACTIVITY", {
    agent: "PLANNER",
    status: "PROCESSING",
    toolName: null,
    summary: "Comparing safe rebooking paths against six locked constraints.",
    evidenceIds: [],
  }),
  replayEvent(6, "HYPOTHESIS_REJECTED", {
    agent: "CRITIC",
    hypothesisId: "41000000-0000-4000-8000-000000000006",
    summary: "Rejected SD-903 because the fare exceeds the locked budget.",
    reasonCode: "CONSTRAINT_VIOLATION",
    evidenceIds: [],
  }),
  replayEvent(7, "AGENT_ACTIVITY", {
    agent: "PLANNER",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Two viable paths remain after constraint evaluation.",
    evidenceIds: [],
  }),
  replayEvent(8, "AGENT_ACTIVITY", {
    agent: "CRITIC",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Blocked over-budget fare and preselected Flex+ add-on.",
    evidenceIds: [],
  }),
  replayEvent(9, "STATE_TRANSITION", {
    from: "PARALLEL_REASON",
    to: "COMPILE",
    reason: "STAGE_SUCCEEDED",
    detail: "Planner and Critic agreed on the evidence-backed candidate.",
  }),
  replayEvent(10, "AGENT_ACTIVITY", {
    agent: "ADAPTIVE_DESIGN",
    status: "PROCESSING",
    toolName: null,
    summary: "Compiling the selected profile into the accessible grammar.",
    evidenceIds: [],
  }),
  replayEvent(11, "AGENT_ACTIVITY", {
    agent: "ADAPTIVE_DESIGN",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Profile-safe surface compiled with a state-bound consent gate.",
    evidenceIds: [],
  }),
  replayEvent(12, "STATE_TRANSITION", {
    from: "COMPILE",
    to: "SIMULATE",
    reason: "STAGE_SUCCEEDED",
    detail: "Adaptive manifest validated against the closed UI grammar.",
  }),
  replayEvent(13, "STATE_TRANSITION", {
    from: "SIMULATE",
    to: "RISK_GATE",
    reason: "STAGE_SUCCEEDED",
    detail: "Simulation found zero policy violations.",
  }),
  replayEvent(14, "STATE_TRANSITION", {
    from: "RISK_GATE",
    to: "EXECUTE_ONE_STEP",
    reason: "STAGE_SUCCEEDED",
    detail: "One reversible selection step admitted.",
  }),
  replayEvent(15, "STATE_TRANSITION", {
    from: "EXECUTE_ONE_STEP",
    to: "VERIFY",
    reason: "STEP_EXECUTED",
    detail: "Exactly one browser action completed; fresh verification is required.",
  }),
  replayEvent(16, "ADAPTER_FORGE_STATUS", {
    type: "ADAPTER_FORGE_ACTIVE",
    requestId: "70000000-0000-4000-8000-000000000001",
    attempt: 1,
    detail: "Unknown surface isolated; Codex is generating a verified adapter.",
    occurredAt: "2026-07-15T10:00:08.000Z",
  }),
]);

export const MUTATION_REPLAY_EVENTS: readonly ObservatoryEvent[] = Object.freeze([
  replayEvent(17, "VERIFICATION_EVIDENCE", {
    verificationResultId: "42000000-0000-4000-8000-000000000017",
    actionStepId: "30000000-0000-4000-8000-000000000001",
    outcome: "MISMATCH",
    summary: "Expected calendar control is absent; a text date field appeared.",
    evidence: [
      {
        evidenceId: "43000000-0000-4000-8000-000000000017",
        kind: "DOM",
        digest: "a".repeat(64),
        summary: "Fresh DOM hash proves the date-control mutation.",
      },
    ],
  }),
  replayEvent(18, "STATE_TRANSITION", {
    from: "VERIFY",
    to: "CAPTURE",
    reason: "VERIFICATION_MISMATCH",
    detail: "Stale target evidence rejected; replan attempt 1 of 3.",
  }),
  replayEvent(19, "AGENT_ACTIVITY", {
    agent: "PERCEPTION",
    status: "PROCESSING",
    toolName: null,
    summary: "Recapturing the mutated source before any further action.",
    evidenceIds: [],
  }),
  replayEvent(20, "AGENT_ACTIVITY", {
    agent: "PERCEPTION",
    status: "TOOL_CALLED",
    toolName: "read_surface_records",
    summary: "Reading the fresh text-date field through the isolated surface runtime.",
    evidenceIds: [],
  }),
  replayEvent(21, "STATE_TRANSITION", {
    from: "CAPTURE",
    to: "NORMALIZE",
    reason: "STAGE_SUCCEEDED",
    detail: "Mutated source captured as page version 2.",
  }),
  replayEvent(22, "AGENT_ACTIVITY", {
    agent: "PERCEPTION",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Calendar drift normalized into a new SurfaceGraph.",
    evidenceIds: [],
  }),
  replayEvent(23, "STATE_TRANSITION", {
    from: "NORMALIZE",
    to: "ROUTE",
    reason: "STAGE_SUCCEEDED",
    detail: "Fresh semantic nodes are ready for routing.",
  }),
  replayEvent(24, "STATE_TRANSITION", {
    from: "ROUTE",
    to: "PARALLEL_REASON",
    reason: "STAGE_SUCCEEDED",
    detail: "Planner and Critic are replanning from fresh evidence.",
  }),
  replayEvent(25, "AGENT_ACTIVITY", {
    agent: "PLANNER",
    status: "PROCESSING",
    toolName: null,
    summary: "Rebinding the date intent to the replacement text field.",
    evidenceIds: [],
  }),
  replayEvent(26, "AGENT_ACTIVITY", {
    agent: "CRITIC",
    status: "PROCESSING",
    toolName: null,
    summary: "Checking that the repaired path preserves all locked constraints.",
    evidenceIds: [],
  }),
  replayEvent(27, "CANDIDATE_PLAN", {
    planId: "44000000-0000-4000-8000-000000000027",
    candidateKey: "text-date-rebind-v2",
    rank: 1,
    status: "SELECTED",
    summary: "Use the fresh text-date node and retain the existing safe fare path.",
    constraintResults: [
      { constraint: "Under INR 8,000", outcome: "PASS" },
      { constraint: "No purchase without consent", outcome: "PASS" },
    ],
  }),
  replayEvent(28, "HYPOTHESIS_REJECTED", {
    agent: "CRITIC",
    hypothesisId: "41000000-0000-4000-8000-000000000028",
    summary: "Rejected reuse of the stale calendar locator.",
    reasonCode: "STALE_SURFACE",
    evidenceIds: [],
  }),
  replayEvent(29, "AGENT_ACTIVITY", {
    agent: "PLANNER",
    status: "SUCCEEDED",
    toolName: null,
    summary: "A page-version-bound repaired plan is ready.",
    evidenceIds: [],
  }),
  replayEvent(30, "AGENT_ACTIVITY", {
    agent: "CRITIC",
    status: "SUCCEEDED",
    toolName: null,
    summary: "Repaired plan preserves budget, route, and consent invariants.",
    evidenceIds: [],
  }),
  replayEvent(31, "STATE_TRANSITION", {
    from: "PARALLEL_REASON",
    to: "COMPILE",
    reason: "STAGE_SUCCEEDED",
    detail: "Safe replan selected from fresh evidence.",
  }),
]);