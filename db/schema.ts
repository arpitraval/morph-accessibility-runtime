import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type {
  AccessProfile,
  AdaptiveUIManifest,
  Adapter,
  AgentEvent,
  InteractionTrace,
  SurfaceGraph,
} from "../packages/contracts/src/index.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
};

export const accessProfiles = pgTable(
  "access_profiles",
  {
    id: uuid("id").primaryKey(),
    subjectKey: text("subject_key").notNull(),
    version: integer("version").notNull(),
    label: text("label").notNull(),
    profile: jsonb("profile").$type<AccessProfile>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("access_profiles_subject_version_uidx").on(table.subjectKey, table.version),
    index("access_profiles_subject_key_idx").on(table.subjectKey),
    check("access_profiles_version_positive", sql`${table.version} > 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    accessProfileId: uuid("access_profile_id")
      .notNull()
      .references(() => accessProfiles.id, { onDelete: "restrict" }),
    targetOrigin: text("target_origin").notNull(),
    intentText: text("intent_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("sessions_access_profile_id_idx").on(table.accessProfileId),
    index("sessions_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Authoritative append-only event stream.
 *
 * The generated PostgreSQL migration revokes UPDATE and DELETE and installs a
 * defensive trigger. Application code must only INSERT with the next sequence
 * under a transaction; no mutable workflow-state column exists elsewhere.
 */
export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    eventVersion: integer("event_version").default(1).notNull(),
    eventType: text("event_type").$type<AgentEvent["type"]>().notNull(),
    actor: text("actor").$type<AgentEvent["actor"]>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    causationId: uuid("causation_id"),
    payload: jsonb("payload").$type<AgentEvent>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_events_session_sequence_uidx").on(table.sessionId, table.sequence),
    uniqueIndex("session_events_session_idempotency_uidx").on(table.sessionId, table.idempotencyKey),
    index("session_events_session_id_idx").on(table.sessionId),
    index("session_events_session_type_idx").on(table.sessionId, table.eventType),
    index("session_events_correlation_id_idx").on(table.correlationId),
    check("session_events_sequence_positive", sql`${table.sequence} > 0`),
    check("session_events_version_one", sql`${table.eventVersion} = 1`),
  ],
);

export const surfaceGraphs = pgTable(
  "surface_graphs",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    pageVersion: integer("page_version").notNull(),
    stateHash: text("state_hash").notNull(),
    graph: jsonb("graph").$type<SurfaceGraph>().notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("surface_graphs_session_page_version_uidx").on(table.sessionId, table.pageVersion),
    index("surface_graphs_session_id_idx").on(table.sessionId),
    index("surface_graphs_state_hash_idx").on(table.stateHash),
    check("surface_graphs_page_version_positive", sql`${table.pageVersion} > 0`),
  ],
);

export const uiManifests = pgTable(
  "ui_manifests",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    accessProfileId: uuid("access_profile_id")
      .notNull()
      .references(() => accessProfiles.id, { onDelete: "restrict" }),
    surfaceGraphId: uuid("surface_graph_id")
      .notNull()
      .references(() => surfaceGraphs.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    manifest: jsonb("manifest").$type<AdaptiveUIManifest>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ui_manifests_session_version_uidx").on(table.sessionId, table.version),
    index("ui_manifests_session_id_idx").on(table.sessionId),
    index("ui_manifests_access_profile_id_idx").on(table.accessProfileId),
    index("ui_manifests_surface_graph_id_idx").on(table.surfaceGraphId),
    check("ui_manifests_version_positive", sql`${table.version} > 0`),
  ],
);

export const adapters = pgTable(
  "adapters",
  {
    id: uuid("id").primaryKey(),
    accessProfileId: uuid("access_profile_id").references(() => accessProfiles.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    status: text("status").$type<Adapter["status"]>().notNull(),
    taskFamily: text("task_family").notNull(),
    domainPattern: text("domain_pattern").notNull(),
    surfaceFingerprint: text("surface_fingerprint").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactSource: text("artifact_source").notNull(),
    signatureAlgorithm: text("signature_algorithm").$type<"Ed25519">().notNull(),
    artifactSignature: text("artifact_signature").notNull(),
    signingKeyId: text("signing_key_id").notNull(),
    provenance: text("provenance").$type<"CODEX_GENERATED" | "PREBUILT_FALLBACK">().notNull(),
    validationReport: jsonb("validation_report")
      .$type<{
        readonly passed: boolean;
        readonly unitPassed: number;
        readonly browserPassed: number;
        readonly accessibilityCriticalViolations: number;
        readonly accessibilitySeriousViolations: number;
        readonly policyPassed: boolean;
        readonly failures: readonly string[];
      }>()
      .notNull(),
    embeddingModel: text("embedding_model"),
    embedding: vector("embedding", { dimensions: 1536 }),
    adapter: jsonb("adapter").$type<Adapter>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("adapters_name_version_uidx").on(table.name, table.version),
    uniqueIndex("adapters_artifact_hash_uidx").on(table.artifactHash),
    index("adapters_access_profile_id_idx").on(table.accessProfileId),
    index("adapters_task_family_idx").on(table.taskFamily),
    index("adapters_domain_pattern_idx").on(table.domainPattern),
    index("adapters_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    check("adapters_version_positive", sql`${table.version} > 0`),
    check(
      "adapters_provenance_valid",
      sql`${table.provenance} in ('CODEX_GENERATED', 'PREBUILT_FALLBACK')`,
    ),
    check("adapters_signature_algorithm_valid", sql`${table.signatureAlgorithm} = 'Ed25519'`),
  ],
);

export const interactionTraces = pgTable(
  "interaction_traces",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    accessProfileId: uuid("access_profile_id")
      .notNull()
      .references(() => accessProfiles.id, { onDelete: "restrict" }),
    adapterId: uuid("adapter_id").references(() => adapters.id, { onDelete: "set null" }),
    taskFamily: text("task_family").notNull(),
    outcome: text("outcome").$type<InteractionTrace["outcome"]>().notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactSource: text("artifact_source").notNull(),
    signatureAlgorithm: text("signature_algorithm").$type<"Ed25519">().notNull(),
    artifactSignature: text("artifact_signature").notNull(),
    signingKeyId: text("signing_key_id").notNull(),
    provenance: text("provenance").$type<"CODEX_GENERATED" | "PREBUILT_FALLBACK">().notNull(),
    validationReport: jsonb("validation_report")
      .$type<{
        readonly passed: boolean;
        readonly unitPassed: number;
        readonly browserPassed: number;
        readonly accessibilityCriticalViolations: number;
        readonly accessibilitySeriousViolations: number;
        readonly policyPassed: boolean;
        readonly failures: readonly string[];
      }>()
      .notNull(),
    trace: jsonb("trace").$type<InteractionTrace>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("interaction_traces_artifact_hash_uidx").on(table.artifactHash),
    index("interaction_traces_session_id_idx").on(table.sessionId),
    index("interaction_traces_access_profile_id_idx").on(table.accessProfileId),
    index("interaction_traces_adapter_id_idx").on(table.adapterId),
    index("interaction_traces_task_family_idx").on(table.taskFamily),
  ],
);

export interface EvalResultRecord {
  readonly schemaVersion: 1;
  readonly assertionsPassed: number;
  readonly assertionsFailed: number;
  readonly metrics: Readonly<Record<string, number | boolean | string | null>>;
  readonly failureCodes: readonly string[];
}

export const evalResults = pgTable(
  "eval_results",
  {
    id: uuid("id").primaryKey(),
    evalCaseKey: text("eval_case_key").notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "restrict" }),
    accessProfileId: uuid("access_profile_id")
      .notNull()
      .references(() => accessProfiles.id, { onDelete: "restrict" }),
    adapterId: uuid("adapter_id").references(() => adapters.id, { onDelete: "set null" }),
    interactionTraceId: uuid("interaction_trace_id").references(() => interactionTraces.id, { onDelete: "set null" }),
    passed: boolean("passed").notNull(),
    score: doublePrecision("score").notNull(),
    result: jsonb("result").$type<EvalResultRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("eval_results_case_key_idx").on(table.evalCaseKey),
    index("eval_results_session_id_idx").on(table.sessionId),
    index("eval_results_access_profile_id_idx").on(table.accessProfileId),
    index("eval_results_adapter_id_idx").on(table.adapterId),
    index("eval_results_interaction_trace_id_idx").on(table.interactionTraceId),
    check("eval_results_score_range", sql`${table.score} >= 0 AND ${table.score} <= 1`),
  ],
);

export const accessProfilesRelations = relations(accessProfiles, ({ many }) => ({
  sessions: many(sessions),
  uiManifests: many(uiManifests),
  adapters: many(adapters),
  interactionTraces: many(interactionTraces),
  evalResults: many(evalResults),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  accessProfile: one(accessProfiles, {
    fields: [sessions.accessProfileId],
    references: [accessProfiles.id],
  }),
  events: many(sessionEvents),
  surfaceGraphs: many(surfaceGraphs),
  uiManifests: many(uiManifests),
  interactionTraces: many(interactionTraces),
  evalResults: many(evalResults),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
}));

export const surfaceGraphsRelations = relations(surfaceGraphs, ({ one, many }) => ({
  session: one(sessions, {
    fields: [surfaceGraphs.sessionId],
    references: [sessions.id],
  }),
  uiManifests: many(uiManifests),
}));

export const uiManifestsRelations = relations(uiManifests, ({ one }) => ({
  session: one(sessions, {
    fields: [uiManifests.sessionId],
    references: [sessions.id],
  }),
  accessProfile: one(accessProfiles, {
    fields: [uiManifests.accessProfileId],
    references: [accessProfiles.id],
  }),
  surfaceGraph: one(surfaceGraphs, {
    fields: [uiManifests.surfaceGraphId],
    references: [surfaceGraphs.id],
  }),
}));

export const adaptersRelations = relations(adapters, ({ one, many }) => ({
  accessProfile: one(accessProfiles, {
    fields: [adapters.accessProfileId],
    references: [accessProfiles.id],
  }),
  interactionTraces: many(interactionTraces),
  evalResults: many(evalResults),
}));

export const interactionTracesRelations = relations(interactionTraces, ({ one, many }) => ({
  session: one(sessions, {
    fields: [interactionTraces.sessionId],
    references: [sessions.id],
  }),
  accessProfile: one(accessProfiles, {
    fields: [interactionTraces.accessProfileId],
    references: [accessProfiles.id],
  }),
  adapter: one(adapters, {
    fields: [interactionTraces.adapterId],
    references: [adapters.id],
  }),
  evalResults: many(evalResults),
}));

export const evalResultsRelations = relations(evalResults, ({ one }) => ({
  session: one(sessions, {
    fields: [evalResults.sessionId],
    references: [sessions.id],
  }),
  accessProfile: one(accessProfiles, {
    fields: [evalResults.accessProfileId],
    references: [accessProfiles.id],
  }),
  adapter: one(adapters, {
    fields: [evalResults.adapterId],
    references: [adapters.id],
  }),
  interactionTrace: one(interactionTraces, {
    fields: [evalResults.interactionTraceId],
    references: [interactionTraces.id],
  }),
}));
