import { z } from "zod";

const IsoTimestampSchema = z.string().datetime({ offset: true });
const IdentifierSchema = z.string().uuid();
const NonEmptyTextSchema = z.string().trim().min(1).max(2_000);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PositiveVersionSchema = z.number().int().positive();

export const RiskClassSchema = z.enum(["R0", "R1", "R2", "R3", "R4", "RX"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const AccessProfileSchema = z
  .object({
    id: IdentifierSchema,
    version: PositiveVersionSchema,
    label: z.string().trim().min(1).max(80),
    locale: z.string().trim().min(2).max(35),
    preset: z.enum(["LOW_VISION", "ONE_SWITCH", "COGNITIVE_LOAD", "CUSTOM"]),
    vision: z
      .object({
        textScale: z.number().min(1).max(3),
        zoomPercent: z.number().int().min(100).max(400),
        contrast: z.enum(["STANDARD", "HIGH", "DARK_HIGH"]),
        reduceMotion: z.boolean(),
      })
      .strict(),
    motor: z
      .object({
        inputMode: z.enum(["POINTER", "KEYBOARD", "SWITCH", "VOICE"]),
        minimumTargetSizePx: z.number().int().min(24).max(96),
        scanIntervalMs: z.number().int().min(250).max(10_000).nullable(),
        dwellTimeMs: z.number().int().min(250).max(10_000).nullable(),
      })
      .strict(),
    cognitive: z
      .object({
        plainLanguage: z.boolean(),
        stepAtATime: z.boolean(),
        maxChoices: z.number().int().min(1).max(12),
        confirmationCadence: z.enum(["ONLY_RISK_BOUNDARIES", "EVERY_STEP"]),
      })
      .strict(),
    speech: z
      .object({
        enabled: z.boolean(),
        rate: z.number().min(0.5).max(2),
      })
      .strict(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .strict();
export type AccessProfile = z.infer<typeof AccessProfileSchema>;

export const EvidenceRefSchema = z
  .object({
    id: IdentifierSchema,
    modality: z.enum(["SCREENSHOT", "DOM", "ACCESSIBILITY_TREE", "PAGE_STATE"]),
    locator: z.string().trim().min(1).max(500),
    contentHash: Sha256Schema,
    capturedAt: IsoTimestampSchema,
  })
  .strict();
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

const SurfaceNodeSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    role: z.string().trim().min(1).max(80),
    name: z.string().max(500).nullable(),
    description: z.string().max(1_000).nullable(),
    value: z.string().max(2_000).nullable(),
    parentId: z.string().trim().min(1).max(160).nullable(),
    childIds: z.array(z.string().trim().min(1).max(160)).max(500),
    interactive: z.boolean(),
    hidden: z.boolean(),
    disabled: z.boolean(),
    states: z
      .object({
        checked: z.boolean().nullable(),
        selected: z.boolean().nullable(),
        expanded: z.boolean().nullable(),
        pressed: z.boolean().nullable(),
        busy: z.boolean(),
        current: z.boolean(),
        required: z.boolean(),
        invalid: z.boolean(),
      })
      .strict(),
    bounds: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().nonnegative(),
        height: z.number().finite().nonnegative(),
      })
      .strict()
      .nullable(),
    evidenceIds: z.array(IdentifierSchema).min(1).max(20),
  })
  .strict();

const SurfaceConflictSchema = z
  .object({
    nodeId: z.string().trim().min(1).max(160).nullable(),
    field: z.string().trim().min(1).max(100),
    observations: z
      .array(
        z
          .object({
            modality: z.enum(["SCREENSHOT", "DOM", "ACCESSIBILITY_TREE", "PAGE_STATE"]),
            value: z.string().max(1_000),
            evidenceId: IdentifierSchema,
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

export const SurfaceGraphSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    pageVersion: PositiveVersionSchema,
    url: z.string().url().max(2_000),
    title: z.string().max(500),
    rootNodeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
    nodes: z.array(SurfaceNodeSchema).min(1).max(10_000),
    evidence: z.array(EvidenceRefSchema).min(1).max(1_000),
    conflicts: z.array(SurfaceConflictSchema).max(1_000),
    stateHash: Sha256Schema,
    capturedAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((graph, context) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    if (nodeIds.size !== graph.nodes.length) {
      context.addIssue({ code: "custom", message: "Surface node ids must be unique", path: ["nodes"] });
    }
    for (const rootId of graph.rootNodeIds) {
      if (!nodeIds.has(rootId)) {
        context.addIssue({ code: "custom", message: "Every root node must exist", path: ["rootNodeIds"] });
      }
    }
  });
export type SurfaceGraph = z.infer<typeof SurfaceGraphSchema>;

const IntentAmbiguitySchema = z
  .object({
    id: IdentifierSchema,
    question: NonEmptyTextSchema,
    options: z.array(z.string().trim().min(1).max(300)).max(12),
    blocking: z.boolean(),
  })
  .strict();

export const IntentGraphSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    goal: NonEmptyTextSchema,
    taskFamily: z.string().trim().min(1).max(120),
    invariants: z.array(NonEmptyTextSchema).min(1).max(50),
    prohibitions: z.array(NonEmptyTextSchema).min(1).max(50),
    ambiguities: z.array(IntentAmbiguitySchema).max(20),
    successEvidence: z.array(NonEmptyTextSchema).min(1).max(30),
    consentBoundaries: z
      .array(
        z
          .object({
            id: IdentifierSchema,
            actionDescription: NonEmptyTextSchema,
            riskClass: z.literal("R4"),
            consequence: NonEmptyTextSchema,
          })
          .strict(),
      )
      .max(20),
    createdAt: IsoTimestampSchema,
  })
  .strict();
export type IntentGraph = z.infer<typeof IntentGraphSchema>;

const AdaptiveComponentSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    kind: z.enum(["HEADING", "TEXT", "STATUS", "ACTION", "GROUP", "CHOICE", "FIELD", "SUMMARY", "CONSENT"]),
    parentId: z.string().trim().min(1).max(120).nullable(),
    order: z.number().int().nonnegative(),
    label: z.string().trim().min(1).max(500),
    description: z.string().max(1_000).nullable(),
    sourceNodeIds: z.array(z.string().trim().min(1).max(160)).max(50),
    actionStepId: IdentifierSchema.nullable(),
    importance: z.enum(["PRIMARY", "SECONDARY", "CONTEXT"]),
    enabled: z.boolean(),
  })
  .strict();

export const AdaptiveUIManifestSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    accessProfileId: IdentifierSchema,
    surfaceGraphId: IdentifierSchema,
    intentGraphId: IdentifierSchema,
    version: PositiveVersionSchema,
    title: z.string().trim().min(1).max(200),
    announcement: z.string().trim().min(1).max(1_000),
    rootComponentIds: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
    components: z.array(AdaptiveComponentSchema).min(1).max(500),
    focusOrder: z.array(z.string().trim().min(1).max(120)).max(500),
    generatedAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    const componentIds = new Set(manifest.components.map((component) => component.id));
    if (componentIds.size !== manifest.components.length) {
      context.addIssue({ code: "custom", message: "Component ids must be unique", path: ["components"] });
    }
    for (const componentId of [...manifest.rootComponentIds, ...manifest.focusOrder]) {
      if (!componentIds.has(componentId)) {
        context.addIssue({ code: "custom", message: "Referenced component must exist", path: ["components"] });
      }
    }
  });
export type AdaptiveUIManifest = z.infer<typeof AdaptiveUIManifestSchema>;

export const AdaptiveExecutionIntentSchema = z
  .object({
    type: z.literal("ADAPTIVE_ACTION_REQUESTED"),
    sessionId: IdentifierSchema,
    manifestId: IdentifierSchema,
    manifestVersion: PositiveVersionSchema,
    accessProfileId: IdentifierSchema,
    componentId: z.string().trim().min(1).max(120),
    actionStepId: IdentifierSchema,
    sourceNodeIds: z.array(z.string().trim().min(1).max(160)).max(50),
    entryState: z.literal("RISK_GATE"),
    requestedState: z.literal("EXECUTE_ONE_STEP"),
    target: z.literal("BROWSER_WORKER"),
    idempotencyKey: z.string().trim().min(12).max(200),
    occurredAt: IsoTimestampSchema,
  })
  .strict();
export type AdaptiveExecutionIntent = z.infer<typeof AdaptiveExecutionIntentSchema>;

export const ActionCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("OBSERVE"), scope: z.enum(["PAGE", "TARGET"]) }).strict(),
  z.object({ kind: z.literal("FOCUS") }).strict(),
  z.object({ kind: z.literal("EXPAND") }).strict(),
  z.object({ kind: z.literal("SELECT"), valueToken: NonEmptyTextSchema }).strict(),
  z.object({ kind: z.literal("INPUT_TEXT"), valueToken: NonEmptyTextSchema, sensitive: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("NAVIGATE"),
      destination: z.enum(["BACK", "FORWARD", "URL"]),
      url: z.string().url().max(2_000).nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("ADD_OPTION"), optionToken: NonEmptyTextSchema }).strict(),
  z.object({ kind: z.literal("REMOVE_OPTION"), optionToken: NonEmptyTextSchema }).strict(),
  z.object({ kind: z.literal("SUBMIT"), formPurpose: NonEmptyTextSchema }).strict(),
]);
export type ActionCommand = z.infer<typeof ActionCommandSchema>;

export const ActionOperationClassSchema = z.enum(["READ", "REVERSIBLE_WRITE", "IRREVERSIBLE"]);
export type ActionOperationClass = z.infer<typeof ActionOperationClassSchema>;

export const ACTION_OPERATION_CLASS = Object.freeze({
  OBSERVE: "READ",
  FOCUS: "READ",
  NAVIGATE: "READ",
  EXPAND: "REVERSIBLE_WRITE",
  SELECT: "REVERSIBLE_WRITE",
  INPUT_TEXT: "REVERSIBLE_WRITE",
  ADD_OPTION: "REVERSIBLE_WRITE",
  REMOVE_OPTION: "REVERSIBLE_WRITE",
  SUBMIT: "IRREVERSIBLE",
} as const satisfies Readonly<Record<ActionCommand["kind"], ActionOperationClass>>);

export const ALLOWED_RISK_CLASSES_BY_OPERATION = Object.freeze({
  READ: ["R0", "R1"],
  REVERSIBLE_WRITE: ["R2", "R3"],
  IRREVERSIBLE: ["R4"],
} as const satisfies Readonly<Record<ActionOperationClass, readonly RiskClass[]>>);

export const ActionStepSchema = z
  .object({
    id: IdentifierSchema,
    ordinal: z.number().int().positive(),
    targetNodeId: z.string().trim().min(1).max(160).nullable(),
    command: ActionCommandSchema,
    riskClass: RiskClassSchema,
    reversible: z.boolean(),
    executionPolicy: z.enum(["ALLOW_AFTER_SIMULATION", "REQUIRE_CONSENT", "DENY"]),
    preconditions: z.array(NonEmptyTextSchema).min(1).max(30),
    expectedPostconditions: z.array(NonEmptyTextSchema).min(1).max(30),
    evidenceRequirements: z.array(NonEmptyTextSchema).min(1).max(30),
    compensationCommand: ActionCommandSchema.nullable(),
    idempotencyKey: z.string().trim().min(12).max(200),
    pageVersion: PositiveVersionSchema,
  })
  .strict()
  .superRefine((step, context) => {
    const operationClass = ACTION_OPERATION_CLASS[step.command.kind];
    const allowedRiskClasses = ALLOWED_RISK_CLASSES_BY_OPERATION[operationClass] as readonly RiskClass[];
    if (step.riskClass !== "RX" && !allowedRiskClasses.includes(step.riskClass)) {
      context.addIssue({
        code: "custom",
        message: step.command.kind + " is " + operationClass + " and cannot use " + step.riskClass,
        path: ["riskClass"],
      });
    }
    if (
      operationClass !== "IRREVERSIBLE" &&
      step.riskClass !== "RX" &&
      (!step.reversible || step.executionPolicy !== "ALLOW_AFTER_SIMULATION")
    ) {
      context.addIssue({
        code: "custom",
        message: "Read and reversible-write commands must remain reversible and simulation-gated",
        path: ["executionPolicy"],
      });
    }
    if (step.riskClass === "R4" && (step.reversible || step.executionPolicy !== "REQUIRE_CONSENT")) {
      context.addIssue({
        code: "custom",
        message: "R4 actions must be irreversible and require consent",
        path: ["executionPolicy"],
      });
    }
    if (step.riskClass === "RX" && step.executionPolicy !== "DENY") {
      context.addIssue({ code: "custom", message: "RX actions must be denied", path: ["executionPolicy"] });
    }
    if (!step.reversible && step.riskClass !== "R4" && step.riskClass !== "RX") {
      context.addIssue({ code: "custom", message: "Only R4 or RX actions may be irreversible", path: ["reversible"] });
    }
    if (step.riskClass === "R2" && step.reversible && step.compensationCommand === null) {
      context.addIssue({
        code: "custom",
        message: "R2 reversible actions require a compensation command",
        path: ["compensationCommand"],
      });
    }
  });
export type ActionStep = z.infer<typeof ActionStepSchema>;

export const ActionPlanSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    intentGraphId: IdentifierSchema,
    surfaceGraphId: IdentifierSchema,
    pageVersion: PositiveVersionSchema,
    status: z.enum(["CANDIDATE", "SELECTED", "REJECTED", "EXPIRED"]),
    steps: z.array(ActionStepSchema).min(1).max(100),
    simulation: z
      .object({
        status: z.enum(["NOT_RUN", "PASSED", "FAILED"]),
        evidenceIds: z.array(IdentifierSchema).max(100),
        violations: z.array(NonEmptyTextSchema).max(50),
        simulatedAt: IsoTimestampSchema.nullable(),
      })
      .strict(),
    createdAt: IsoTimestampSchema,
    expiresAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    plan.steps.forEach((step, index) => {
      if (step.ordinal !== index + 1) {
        context.addIssue({ code: "custom", message: "Step ordinals must be contiguous", path: ["steps", index, "ordinal"] });
      }
      if (step.pageVersion !== plan.pageVersion) {
        context.addIssue({ code: "custom", message: "Every step must target the plan page version", path: ["steps", index] });
      }
    });
    if (
      plan.status === "SELECTED" &&
      (plan.simulation.status !== "PASSED" || plan.steps.some((step) => step.executionPolicy === "DENY"))
    ) {
      context.addIssue({
        code: "custom",
        message: "A selected plan must pass simulation and contain no denied action",
        path: ["status"],
      });
    }
  });
export type ActionPlan = z.infer<typeof ActionPlanSchema>;

export const VerificationResultSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    actionStepId: IdentifierSchema,
    expectedPageVersion: PositiveVersionSchema,
    observedPageVersion: PositiveVersionSchema,
    outcome: z.enum(["MATCH", "MISMATCH", "INCONCLUSIVE"]),
    evidenceIds: z.array(IdentifierSchema).min(1).max(100),
    satisfiedPostconditions: z.array(NonEmptyTextSchema).max(30),
    mismatches: z.array(NonEmptyTextSchema).max(30),
    verifier: z.enum(["DETERMINISTIC", "INDEPENDENT_AGENT"]),
    verifiedAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.outcome === "MATCH" && result.mismatches.length > 0) {
      context.addIssue({ code: "custom", message: "A matching verification cannot contain mismatches", path: ["mismatches"] });
    }
    if (result.outcome === "MISMATCH" && result.mismatches.length === 0) {
      context.addIssue({ code: "custom", message: "A mismatch requires evidence-backed reasons", path: ["mismatches"] });
    }
  });
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const ConsentStatusSchema = z.enum(["PENDING", "GRANTED", "DENIED", "REVOKED", "EXPIRED"]);
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;

export const ConsentRecordSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    actionStepId: IdentifierSchema,
    riskClass: z.literal("R4"),
    pageVersion: PositiveVersionSchema,
    exactActionHash: Sha256Schema,
    actionSummary: NonEmptyTextSchema,
    consequence: NonEmptyTextSchema,
    status: ConsentStatusSchema,
    presentationMode: z.enum(["VISUAL", "SCREEN_READER", "SWITCH_SCAN", "VOICE"]),
    presentedAt: IsoTimestampSchema,
    respondedAt: IsoTimestampSchema.nullable(),
    expiresAt: IsoTimestampSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (record.status !== "PENDING" && record.respondedAt === null) {
      context.addIssue({ code: "custom", message: "Resolved consent requires a response timestamp", path: ["respondedAt"] });
    }
  });
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export const WorkflowStateSchema = z.enum([
  "CAPTURE",
  "NORMALIZE",
  "ROUTE",
  "PARALLEL_REASON",
  "COMPILE",
  "SIMULATE",
  "RISK_GATE",
  "EXECUTE_ONE_STEP",
  "VERIFY",
  "ASK_USER",
  "REQUIRE_CONSENT",
  "COMPLETE",
  "STOP_SAFE",
]);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const TransitionReasonSchema = z.enum([
  "SESSION_STARTED",
  "STAGE_SUCCEEDED",
  "AMBIGUITY_DETECTED",
  "USER_INPUT_RECEIVED",
  "IRREVERSIBLE_ACTION",
  "CONSENT_GRANTED",
  "CONSENT_DENIED",
  "STEP_EXECUTED",
  "VERIFICATION_MATCH_NEXT_STEP",
  "VERIFICATION_MATCH_COMPLETE",
  "VERIFICATION_MISMATCH",
  "VERIFICATION_INCONCLUSIVE",
  "RETRY_EXHAUSTED",
  "FATAL_ERROR",
]);
export type TransitionReason = z.infer<typeof TransitionReasonSchema>;

export const SpecialistAgentSchema = z.enum(["PERCEPTION", "ADAPTIVE_DESIGN", "PLANNER", "CRITIC"]);
export type SpecialistAgent = z.infer<typeof SpecialistAgentSchema>;

export const AdapterForgeStatusTypeSchema = z.enum([
  "ADAPTER_FORGE_ACTIVE",
  "ADAPTER_FORGE_TESTING",
  "ADAPTER_FORGE_REPAIRING",
  "ADAPTER_FORGE_PUBLISHED",
  "ADAPTER_FORGE_FALLBACK",
  "ADAPTER_FORGE_STOPPED_SAFE",
]);
export type AdapterForgeStatusType = z.infer<typeof AdapterForgeStatusTypeSchema>;

export const AdapterForgeStatusSchema = z
  .object({
    type: AdapterForgeStatusTypeSchema,
    requestId: IdentifierSchema,
    attempt: z.number().int().min(1).max(3),
    detail: NonEmptyTextSchema,
    occurredAt: IsoTimestampSchema,
  })
  .strict();
export type AdapterForgeStatus = z.infer<typeof AdapterForgeStatusSchema>;

const ObservatoryEvidenceSchema = z
  .object({
    evidenceId: IdentifierSchema,
    kind: z.enum(["DOM", "ACCESSIBILITY_TREE", "SCREENSHOT_HASH", "URL", "PAGE_STATE"]),
    digest: Sha256Schema,
    summary: NonEmptyTextSchema,
  })
  .strict();

const AgentEventBaseSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    sequence: z.number().int().positive(),
    version: z.literal(1),
    actor: z.enum(["USER", "ORCHESTRATOR", "AGENT", "BROWSER_WORKER", "SAFETY_GOVERNOR", "SYSTEM"]),
    idempotencyKey: z.string().trim().min(12).max(200),
    correlationId: IdentifierSchema,
    causationId: IdentifierSchema.nullable(),
    occurredAt: IsoTimestampSchema,
  })
  .strict();

export const AgentEventSchema = z.discriminatedUnion("type", [
  AgentEventBaseSchema.extend({
    type: z.literal("SESSION_STARTED"),
    data: z.object({ accessProfileId: IdentifierSchema, initialState: z.literal("CAPTURE") }).strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("STATE_TRANSITIONED"),
    data: z
      .object({
        from: WorkflowStateSchema,
        to: WorkflowStateSchema,
        reason: TransitionReasonSchema,
        resumeState: WorkflowStateSchema.nullable(),
        detail: z.string().trim().min(1).max(1_000),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("ARTIFACT_RECORDED"),
    data: z
      .object({
        artifactKind: z.enum([
          "ACCESS_PROFILE",
          "SURFACE_GRAPH",
          "INTENT_GRAPH",
          "UI_MANIFEST",
          "ACTION_PLAN",
          "ADAPTER",
          "INTERACTION_TRACE",
        ]),
        artifactId: IdentifierSchema,
        artifactVersion: PositiveVersionSchema,
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("USER_INPUT_REQUIRED"),
    data: z.object({ ambiguityIds: z.array(IdentifierSchema).min(1).max(20), question: NonEmptyTextSchema }).strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("USER_INPUT_RECORDED"),
    data: z.object({ ambiguityIds: z.array(IdentifierSchema).min(1).max(20), redactedAnswerSummary: NonEmptyTextSchema }).strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("CONSENT_REQUIRED"),
    data: z.object({ consentRecordId: IdentifierSchema, actionStepId: IdentifierSchema, pageVersion: PositiveVersionSchema }).strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("CONSENT_RECORDED"),
    data: z.object({ consentRecordId: IdentifierSchema, actionStepId: IdentifierSchema, status: ConsentStatusSchema }).strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("ACTION_EXECUTED"),
    data: z
      .object({
        actionStepId: IdentifierSchema,
        pageVersionBefore: PositiveVersionSchema,
        pageVersionAfter: PositiveVersionSchema,
        result: z.enum(["EXECUTED", "REJECTED", "FAILED"]),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("VERIFICATION_RECORDED"),
    data: z
      .object({
        verificationResultId: IdentifierSchema,
        actionStepId: IdentifierSchema,
        outcome: z.enum(["MATCH", "MISMATCH", "INCONCLUSIVE"]),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("AGENT_ACTIVITY_RECORDED"),
    data: z
      .object({
        agent: SpecialistAgentSchema,
        status: z.enum(["PROCESSING", "TOOL_CALLED", "SUCCEEDED", "FAILED"]),
        toolName: z.string().trim().min(1).max(120).nullable(),
        summary: NonEmptyTextSchema,
        evidenceIds: z.array(IdentifierSchema).max(50),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("CANDIDATE_PLAN_RECORDED"),
    data: z
      .object({
        planId: IdentifierSchema,
        candidateKey: z.string().trim().min(1).max(120),
        rank: z.number().int().positive().max(20),
        status: z.enum(["CANDIDATE", "SELECTED", "REJECTED"]),
        summary: NonEmptyTextSchema,
        constraintResults: z
          .array(
            z
              .object({
                constraint: NonEmptyTextSchema,
                outcome: z.enum(["PASS", "WARN", "FAIL"]),
              })
              .strict(),
          )
          .max(30),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("HYPOTHESIS_REJECTED"),
    data: z
      .object({
        agent: z.literal("CRITIC"),
        hypothesisId: IdentifierSchema,
        summary: NonEmptyTextSchema,
        reasonCode: z.enum([
          "CONSTRAINT_VIOLATION",
          "UNVERIFIED_ASSUMPTION",
          "RISK_POLICY",
          "STALE_SURFACE",
          "LOW_CONFIDENCE",
        ]),
        evidenceIds: z.array(IdentifierSchema).max(50),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("VERIFICATION_EVIDENCE_RECORDED"),
    data: z
      .object({
        verificationResultId: IdentifierSchema,
        actionStepId: IdentifierSchema,
        outcome: z.enum(["MATCH", "MISMATCH", "INCONCLUSIVE"]),
        summary: NonEmptyTextSchema,
        evidence: z.array(ObservatoryEvidenceSchema).min(1).max(30),
        redaction: z
          .object({ rawScreenshotExcluded: z.literal(true), reasoningExcluded: z.literal(true) })
          .strict(),
      })
      .strict(),
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("ADAPTER_FORGE_STATUS_RECORDED"),
    data: AdapterForgeStatusSchema,
  }).strict(),
  AgentEventBaseSchema.extend({
    type: z.literal("SESSION_STOPPED"),
    data: z
      .object({
        reason: z.enum(["COMPLETE", "RETRY_EXHAUSTED", "CONSENT_DENIED", "FATAL_ERROR", "POLICY_DENIED"]),
        detail: NonEmptyTextSchema,
      })
      .strict(),
  }).strict(),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

const ObservatoryEventBaseSchema = z
  .object({
    sessionId: IdentifierSchema,
    sequence: z.number().int().positive(),
    eventId: IdentifierSchema,
    occurredAt: IsoTimestampSchema,
    redaction: z
      .object({ reasoningExcluded: z.literal(true), rawModelOutputExcluded: z.literal(true) })
      .strict(),
  })
  .strict();

export const ObservatoryEventSchema = z.discriminatedUnion("kind", [
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("STATE_TRANSITION"),
    data: z
      .object({
        from: WorkflowStateSchema,
        to: WorkflowStateSchema,
        reason: TransitionReasonSchema,
        detail: NonEmptyTextSchema,
      })
      .strict(),
  }).strict(),
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("AGENT_ACTIVITY"),
    data: z
      .object({
        agent: SpecialistAgentSchema,
        status: z.enum(["PROCESSING", "TOOL_CALLED", "SUCCEEDED", "FAILED"]),
        toolName: z.string().trim().min(1).max(120).nullable(),
        summary: NonEmptyTextSchema,
        evidenceIds: z.array(IdentifierSchema).max(50),
      })
      .strict(),
  }).strict(),
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("CANDIDATE_PLAN"),
    data: z
      .object({
        planId: IdentifierSchema,
        candidateKey: z.string().trim().min(1).max(120),
        rank: z.number().int().positive().max(20),
        status: z.enum(["CANDIDATE", "SELECTED", "REJECTED"]),
        summary: NonEmptyTextSchema,
        constraintResults: z
          .array(
            z.object({ constraint: NonEmptyTextSchema, outcome: z.enum(["PASS", "WARN", "FAIL"]) }).strict(),
          )
          .max(30),
      })
      .strict(),
  }).strict(),
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("HYPOTHESIS_REJECTED"),
    data: z
      .object({
        agent: z.literal("CRITIC"),
        hypothesisId: IdentifierSchema,
        summary: NonEmptyTextSchema,
        reasonCode: z.enum([
          "CONSTRAINT_VIOLATION",
          "UNVERIFIED_ASSUMPTION",
          "RISK_POLICY",
          "STALE_SURFACE",
          "LOW_CONFIDENCE",
        ]),
        evidenceIds: z.array(IdentifierSchema).max(50),
      })
      .strict(),
  }).strict(),
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("VERIFICATION_EVIDENCE"),
    data: z
      .object({
        verificationResultId: IdentifierSchema,
        actionStepId: IdentifierSchema,
        outcome: z.enum(["MATCH", "MISMATCH", "INCONCLUSIVE"]),
        summary: NonEmptyTextSchema,
        evidence: z.array(ObservatoryEvidenceSchema).max(30),
      })
      .strict(),
  }).strict(),
  ObservatoryEventBaseSchema.extend({
    kind: z.literal("ADAPTER_FORGE_STATUS"),
    data: AdapterForgeStatusSchema,
  }).strict(),
]);
export type ObservatoryEvent = z.infer<typeof ObservatoryEventSchema>;

export const AdapterSchema = z
  .object({
    id: IdentifierSchema,
    accessProfileId: IdentifierSchema.nullable(),
    name: z.string().trim().min(1).max(120),
    version: PositiveVersionSchema,
    status: z.enum(["DRAFT", "VERIFIED", "QUARANTINED", "RETIRED"]),
    taskFamily: z.string().trim().min(1).max(120),
    domainPattern: z.string().trim().min(1).max(500),
    supportedLocales: z.array(z.string().trim().min(2).max(35)).min(1).max(50),
    capabilities: z
      .object({
        observes: z.boolean(),
        acts: z.boolean(),
        supportsSimulation: z.boolean(),
        requiresAuthentication: z.boolean(),
      })
      .strict(),
    minimumSurfaceSchemaVersion: PositiveVersionSchema,
    artifactHash: Sha256Schema,
    testReport: z
      .object({
        unitPassed: z.number().int().nonnegative(),
        browserPassed: z.number().int().nonnegative(),
        accessibilityCriticalViolations: z.number().int().nonnegative(),
        policyPassed: z.boolean(),
      })
      .strict(),
    embeddingModel: z.string().trim().min(1).max(120).nullable(),
    embeddingDimensions: z.literal(1536).nullable(),
    createdAt: IsoTimestampSchema,
    verifiedAt: IsoTimestampSchema.nullable(),
  })
  .strict()
  .superRefine((adapter, context) => {
    if ((adapter.embeddingModel === null) !== (adapter.embeddingDimensions === null)) {
      context.addIssue({
        code: "custom",
        message: "Embedding model and dimensions must be set together",
        path: ["embeddingModel"],
      });
    }
    if (
      adapter.status === "VERIFIED" &&
      (!adapter.testReport.policyPassed || adapter.testReport.accessibilityCriticalViolations > 0 || adapter.verifiedAt === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Verified adapters require a clean policy/accessibility report and verification timestamp",
        path: ["status"],
      });
    }
  });
export type Adapter = z.infer<typeof AdapterSchema>;

const InteractionTraceStepSchema = z
  .object({
    ordinal: z.number().int().positive(),
    actionStepId: IdentifierSchema,
    commandKind: z.enum([
      "OBSERVE",
      "FOCUS",
      "EXPAND",
      "SELECT",
      "INPUT_TEXT",
      "NAVIGATE",
      "ADD_OPTION",
      "REMOVE_OPTION",
      "SUBMIT",
    ]),
    result: z.enum(["VERIFIED", "MISMATCH", "REJECTED", "FAILED"]),
    verificationResultId: IdentifierSchema.nullable(),
    evidenceHashes: z.array(Sha256Schema).min(1).max(30),
    startedAt: IsoTimestampSchema,
    completedAt: IsoTimestampSchema,
  })
  .strict();

export const InteractionTraceSchema = z
  .object({
    id: IdentifierSchema,
    sessionId: IdentifierSchema,
    adapterId: IdentifierSchema.nullable(),
    accessProfileId: IdentifierSchema,
    taskFamily: z.string().trim().min(1).max(120),
    surfaceFingerprint: Sha256Schema,
    outcome: z.enum(["COMPLETE", "STOPPED_SAFE", "FAILED"]),
    steps: z.array(InteractionTraceStepSchema).min(1).max(100),
    replanCount: z.number().int().min(0).max(3),
    redaction: z
      .object({
        screenshotsExcluded: z.literal(true),
        personalDataExcluded: z.literal(true),
        secretsExcluded: z.literal(true),
      })
      .strict(),
    artifactHash: Sha256Schema,
    startedAt: IsoTimestampSchema,
    completedAt: IsoTimestampSchema,
  })
  .strict();
export type InteractionTrace = z.infer<typeof InteractionTraceSchema>;

export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 2;
  readonly status: "implemented";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/contracts",
  phase: 2,
  status: "implemented",
  responsibility: "Own strict runtime schemas and canonical cross-process TypeScript types.",
});
