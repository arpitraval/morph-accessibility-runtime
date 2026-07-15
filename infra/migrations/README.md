# Migrations

Phase 2 targets PostgreSQL with pgvector. Generated Drizzle artifacts live in
`generated/` and are committed so the schema can be reviewed without a live
database.

The initial migration:

- enables the `vector` extension;
- creates the eight canonical Phase 2 tables;
- installs foreign keys, uniqueness constraints, checks, and lookup indexes;
- creates a cosine HNSW index over adapter embeddings; and
- installs a defensive trigger that rejects updates and deletes on
  `session_events`.
