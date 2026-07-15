DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "adapters") THEN
    RAISE EXCEPTION 'Phase 7 adapter signing migration requires an explicit legacy artifact backfill';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "artifact_source" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "signature_algorithm" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "artifact_signature" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "signing_key_id" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "provenance" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD COLUMN "validation_report" jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "adapters" ADD CONSTRAINT "adapters_provenance_valid" CHECK ("adapters"."provenance" in ('CODEX_GENERATED', 'PREBUILT_FALLBACK'));
--> statement-breakpoint
ALTER TABLE "adapters" ADD CONSTRAINT "adapters_signature_algorithm_valid" CHECK ("adapters"."signature_algorithm" = 'Ed25519');
