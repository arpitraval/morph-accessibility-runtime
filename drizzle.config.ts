import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./infra/migrations/generated",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  strict: true,
  verbose: true,
});
