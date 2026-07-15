CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "access_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_key" text NOT NULL,
	"version" integer NOT NULL,
	"label" text NOT NULL,
	"profile" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_profiles_version_positive" CHECK ("access_profiles"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "adapters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"access_profile_id" uuid,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"task_family" text NOT NULL,
	"domain_pattern" text NOT NULL,
	"surface_fingerprint" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"embedding_model" text,
	"embedding" vector(1536),
	"adapter" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adapters_version_positive" CHECK ("adapters"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "eval_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"eval_case_key" text NOT NULL,
	"session_id" uuid,
	"access_profile_id" uuid NOT NULL,
	"adapter_id" uuid,
	"interaction_trace_id" uuid,
	"passed" boolean NOT NULL,
	"score" double precision NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eval_results_score_range" CHECK ("eval_results"."score" >= 0 AND "eval_results"."score" <= 1)
);
--> statement-breakpoint
CREATE TABLE "interaction_traces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"access_profile_id" uuid NOT NULL,
	"adapter_id" uuid,
	"task_family" text NOT NULL,
	"outcome" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"trace" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_events_sequence_positive" CHECK ("session_events"."sequence" > 0),
	CONSTRAINT "session_events_version_one" CHECK ("session_events"."event_version" = 1)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"access_profile_id" uuid NOT NULL,
	"target_origin" text NOT NULL,
	"intent_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "surface_graphs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"page_version" integer NOT NULL,
	"state_hash" text NOT NULL,
	"graph" jsonb NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surface_graphs_page_version_positive" CHECK ("surface_graphs"."page_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "ui_manifests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"access_profile_id" uuid NOT NULL,
	"surface_graph_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"manifest" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ui_manifests_version_positive" CHECK ("ui_manifests"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "adapters" ADD CONSTRAINT "adapters_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_adapter_id_adapters_id_fk" FOREIGN KEY ("adapter_id") REFERENCES "public"."adapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_results" ADD CONSTRAINT "eval_results_interaction_trace_id_interaction_traces_id_fk" FOREIGN KEY ("interaction_trace_id") REFERENCES "public"."interaction_traces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_traces" ADD CONSTRAINT "interaction_traces_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_traces" ADD CONSTRAINT "interaction_traces_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_traces" ADD CONSTRAINT "interaction_traces_adapter_id_adapters_id_fk" FOREIGN KEY ("adapter_id") REFERENCES "public"."adapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surface_graphs" ADD CONSTRAINT "surface_graphs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_manifests" ADD CONSTRAINT "ui_manifests_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_manifests" ADD CONSTRAINT "ui_manifests_access_profile_id_access_profiles_id_fk" FOREIGN KEY ("access_profile_id") REFERENCES "public"."access_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ui_manifests" ADD CONSTRAINT "ui_manifests_surface_graph_id_surface_graphs_id_fk" FOREIGN KEY ("surface_graph_id") REFERENCES "public"."surface_graphs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_profiles_subject_version_uidx" ON "access_profiles" USING btree ("subject_key","version");--> statement-breakpoint
CREATE INDEX "access_profiles_subject_key_idx" ON "access_profiles" USING btree ("subject_key");--> statement-breakpoint
CREATE UNIQUE INDEX "adapters_name_version_uidx" ON "adapters" USING btree ("name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "adapters_artifact_hash_uidx" ON "adapters" USING btree ("artifact_hash");--> statement-breakpoint
CREATE INDEX "adapters_access_profile_id_idx" ON "adapters" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "adapters_task_family_idx" ON "adapters" USING btree ("task_family");--> statement-breakpoint
CREATE INDEX "adapters_domain_pattern_idx" ON "adapters" USING btree ("domain_pattern");--> statement-breakpoint
CREATE INDEX "adapters_embedding_hnsw_idx" ON "adapters" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "eval_results_case_key_idx" ON "eval_results" USING btree ("eval_case_key");--> statement-breakpoint
CREATE INDEX "eval_results_session_id_idx" ON "eval_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "eval_results_access_profile_id_idx" ON "eval_results" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "eval_results_adapter_id_idx" ON "eval_results" USING btree ("adapter_id");--> statement-breakpoint
CREATE INDEX "eval_results_interaction_trace_id_idx" ON "eval_results" USING btree ("interaction_trace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interaction_traces_artifact_hash_uidx" ON "interaction_traces" USING btree ("artifact_hash");--> statement-breakpoint
CREATE INDEX "interaction_traces_session_id_idx" ON "interaction_traces" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "interaction_traces_access_profile_id_idx" ON "interaction_traces" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "interaction_traces_adapter_id_idx" ON "interaction_traces" USING btree ("adapter_id");--> statement-breakpoint
CREATE INDEX "interaction_traces_task_family_idx" ON "interaction_traces" USING btree ("task_family");--> statement-breakpoint
CREATE UNIQUE INDEX "session_events_session_sequence_uidx" ON "session_events" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "session_events_session_idempotency_uidx" ON "session_events" USING btree ("session_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "session_events_session_id_idx" ON "session_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_events_session_type_idx" ON "session_events" USING btree ("session_id","event_type");--> statement-breakpoint
CREATE INDEX "session_events_correlation_id_idx" ON "session_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "sessions_access_profile_id_idx" ON "sessions" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "surface_graphs_session_page_version_uidx" ON "surface_graphs" USING btree ("session_id","page_version");--> statement-breakpoint
CREATE INDEX "surface_graphs_session_id_idx" ON "surface_graphs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "surface_graphs_state_hash_idx" ON "surface_graphs" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "ui_manifests_session_version_uidx" ON "ui_manifests" USING btree ("session_id","version");--> statement-breakpoint
CREATE INDEX "ui_manifests_session_id_idx" ON "ui_manifests" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ui_manifests_access_profile_id_idx" ON "ui_manifests" USING btree ("access_profile_id");--> statement-breakpoint
CREATE INDEX "ui_manifests_surface_graph_id_idx" ON "ui_manifests" USING btree ("surface_graph_id");
--> statement-breakpoint
COMMENT ON TABLE "session_events" IS 'MORPH authoritative append-only workflow event log';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION morph_reject_session_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'session_events is append-only' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "session_events_append_only"
BEFORE UPDATE OR DELETE ON "session_events"
FOR EACH ROW EXECUTE FUNCTION morph_reject_session_event_mutation();
