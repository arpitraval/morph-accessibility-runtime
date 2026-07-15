/**
 * Phase 2 owns the PostgreSQL/pgvector schema and configuration boundary.
 * A concrete connection pool belongs in the orchestrator composition root;
 * importing this module never opens a connection or creates mutable state.
 */

export * from "./schema.js";

export interface DatabaseConfiguration {
  readonly url: string;
}

export function resolveDatabaseConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): DatabaseConfiguration {
  const value = environment.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for MORPH durable state.");
  }
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }
  return Object.freeze({ url: value });
}
