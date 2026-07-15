import { createHash, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AdapterSchema } from "../packages/contracts/src/index.js";
import type {
  AdapterPublisher,
  ArtifactSigner,
  VerifiedAdapterArtifact,
} from "../apps/adapter-forge/src/pipeline.js";
import { adapters } from "./schema.js";
import * as schema from "./schema.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function equalDigest(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export class DrizzleAdapterPublisher implements AdapterPublisher {
  readonly #database: NodePgDatabase<typeof schema>;
  readonly #signatureVerifier: ArtifactSigner;

  public constructor(
    database: NodePgDatabase<typeof schema>,
    signatureVerifier: ArtifactSigner,
  ) {
    this.#database = database;
    this.#signatureVerifier = signatureVerifier;
  }

  public async publish(artifact: VerifiedAdapterArtifact): Promise<void> {
    const adapter = AdapterSchema.parse(artifact.adapter);
    const observedHash = sha256(artifact.sourceCode);
    if (!equalDigest(observedHash, adapter.artifactHash)) {
      throw new Error("Adapter source does not match its signed artifact hash.");
    }
    if (
      adapter.status !== "VERIFIED" ||
      adapter.embeddingModel === null ||
      adapter.embeddingDimensions !== 1536 ||
      artifact.embedding.length !== 1536 ||
      artifact.embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Only verified, embedded adapters may enter durable routing.");
    }
    if (
      artifact.signature.algorithm !== "Ed25519" ||
      artifact.signature.value.trim().length === 0 ||
      artifact.signature.keyId.trim().length === 0
    ) {
      throw new Error("Unsigned or unsupported adapter artifact rejected.");
    }
    if (!(await this.#signatureVerifier.verifyArtifactHash(adapter.artifactHash, artifact.signature))) {
      throw new Error("Adapter signature failed independent persistence verification.");
    }

    await this.#database.transaction(async (transaction) => {
      await transaction.execute(sql`set local statement_timeout = '10s'`);
      await transaction
        .insert(adapters)
        .values({
          id: adapter.id,
          accessProfileId: adapter.accessProfileId,
          name: adapter.name,
          version: adapter.version,
          status: adapter.status,
          taskFamily: adapter.taskFamily,
          domainPattern: adapter.domainPattern,
          surfaceFingerprint: artifact.surfaceFingerprint,
          artifactHash: adapter.artifactHash,
          artifactSource: artifact.sourceCode,
          signatureAlgorithm: artifact.signature.algorithm,
          artifactSignature: artifact.signature.value,
          signingKeyId: artifact.signature.keyId,
          provenance: artifact.provenance,
          validationReport: artifact.validationReport,
          embeddingModel: adapter.embeddingModel,
          embedding: [...artifact.embedding],
          adapter,
        })
        .onConflictDoNothing();

      const rows = await transaction
        .select({
          artifactHash: adapters.artifactHash,
          artifactSource: adapters.artifactSource,
          surfaceFingerprint: adapters.surfaceFingerprint,
        })
        .from(adapters)
        .where(eq(adapters.artifactHash, adapter.artifactHash))
        .limit(1);
      const persisted = rows[0];
      if (
        !persisted ||
        persisted.artifactSource !== artifact.sourceCode ||
        persisted.surfaceFingerprint !== artifact.surfaceFingerprint
      ) {
        throw new Error("Adapter persistence conflict failed the idempotency check.");
      }
    });
  }
}
