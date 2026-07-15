# Infrastructure boundary

Infrastructure files are intentionally minimal in Phase 1.

- `migrations/` will receive PostgreSQL/pgvector migrations in Phase 2.
- `seeds/` will receive deterministic travel fixtures in Phase 2 and Phase 3.
- `deployment/` will receive runtime topology and packaging declarations after local architecture is verified.

OpenAI Sites configuration remains at `.openai/hosting.json`. Its D1 and R2 bindings stay null under ADR-0007.
