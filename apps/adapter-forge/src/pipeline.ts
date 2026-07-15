import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";
import { AdapterSchema, type Adapter } from "@morph/contracts";
import OpenAI from "openai";
import { z } from "zod";
import {
  AdapterForgeRequestSchema,
  ForgeStatusEventSchema,
  MAX_FORGE_ATTEMPTS,
  conciseFailure,
  createEphemeralForgeWorkspace,
  type AdapterForgeRequest,
  type AdapterGenerator,
  type CodexProgressSink,
  type EphemeralForgeWorkspace,
  type ForgeStatusEvent,
  type ForgeStatusSink,
} from "./forge.js";
import {
  ForgeTestReportSchema,
  validateAdapterSource,
  type ForgeTestReport,
} from "./harness.js";

export const ADAPTER_EMBEDDING_DIMENSIONS = 1_536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_FORGE_PIPELINE_TIMEOUT_MS = 85_000;
export const ADAPTER_VALIDATION_TIMEOUT_MS = 15_000;
export const ADAPTER_PUBLICATION_TIMEOUT_MS = 15_000;

export type AdapterProvenance = "CODEX_GENERATED" | "PREBUILT_FALLBACK";

export const PREVALIDATED_FALLBACK_SOURCE = `export const adapter = {
  name: "morph-prebuilt-generic-v1",
  version: 1,
  matches(fixture) {
    return fixture.requiredActionIds.every((requiredId) =>
      fixture.records.some((record) =>
        record.id === requiredId &&
        record.interactive &&
        record.visible &&
        !record.disabled
      )
    );
  },
  project(fixture) {
    const required = fixture.requiredActionIds.map((requiredId) =>
      fixture.records.find((record) => record.id === requiredId)
    );
    return {
      heading: "Safe actions",
      summary: "A pre-validated MORPH adapter recovered the essential actions for this page.",
      actions: required.map((record) => ({
        id: "fallback-" + record.id,
        label: record.name ?? record.description ?? "Continue",
        description: record.description ?? "Available action",
        sourceNodeId: record.id,
        target: record.selector !== null
          ? { strategy: "CSS", value: record.selector, accessibleName: null }
          : record.role !== null && record.name !== null
            ? { strategy: "ROLE", value: record.role, accessibleName: record.name }
            : { strategy: "TEXT", value: record.name ?? "Continue", accessibleName: null }
      }))
    };
  }
};
`;

const ArtifactSignatureSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    keyId: z.string().trim().min(1).max(120),
    value: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(1_000),
  })
  .strict();
export type ArtifactSignature = z.infer<typeof ArtifactSignatureSchema>;

export interface VerifiedAdapterArtifact {
  readonly adapter: Adapter;
  readonly sourceCode: string;
  readonly signature: ArtifactSignature;
  readonly provenance: AdapterProvenance;
  readonly surfaceFingerprint: string;
  readonly embedding: readonly number[];
  readonly validationReport: ForgeTestReport;
}

export interface AdapterPublisher {
  publish(artifact: VerifiedAdapterArtifact): Promise<void>;
}

export interface AdapterEmbeddingProvider {
  readonly model: string;
  embedRoutingText(text: string): Promise<readonly number[]>;
}

export interface ArtifactSigner {
  signArtifactHash(artifactHash: string): Promise<ArtifactSignature>;
  verifyArtifactHash(artifactHash: string, signature: ArtifactSignature): Promise<boolean>;
}

export interface Ed25519ArtifactSignerOptions {
  readonly privateKeyPem: string;
  readonly keyId: string;
}

export class Ed25519ArtifactSigner implements ArtifactSigner {
  readonly #privateKey: KeyObject;
  readonly #publicKey: KeyObject;
  readonly #keyId: string;

  public constructor(options: Ed25519ArtifactSignerOptions) {
    if (options.keyId.trim().length === 0 || options.keyId.length > 120) {
      throw new Error("Adapter signing key id is invalid.");
    }
    this.#privateKey = createPrivateKey(options.privateKeyPem);
    if (this.#privateKey.asymmetricKeyType !== "ed25519") {
      throw new Error("Adapter Forge requires an Ed25519 private signing key.");
    }
    this.#publicKey = createPublicKey(this.#privateKey);
    this.#keyId = options.keyId;
  }

  public async signArtifactHash(artifactHash: string): Promise<ArtifactSignature> {
    const digest = digestBuffer(artifactHash);
    return ArtifactSignatureSchema.parse({
      algorithm: "Ed25519",
      keyId: this.#keyId,
      value: signBytes(null, digest, this.#privateKey).toString("base64"),
    });
  }

  public async verifyArtifactHash(
    artifactHash: string,
    rawSignature: ArtifactSignature,
  ): Promise<boolean> {
    const signature = ArtifactSignatureSchema.parse(rawSignature);
    if (signature.keyId !== this.#keyId) return false;
    return verifyBytes(
      null,
      digestBuffer(artifactHash),
      this.#publicKey,
      Buffer.from(signature.value, "base64"),
    );
  }
}

function digestBuffer(artifactHash: string): Buffer {
  if (!/^[a-f0-9]{64}$/.test(artifactHash)) {
    throw new Error("Artifact hash must be a lowercase SHA-256 digest.");
  }
  return Buffer.from(artifactHash, "hex");
}

export interface OpenAIAdapterEmbeddingProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
}

export class OpenAIAdapterEmbeddingProvider implements AdapterEmbeddingProvider {
  readonly model: string;
  readonly #client: OpenAI;

  public constructor(options: OpenAIAdapterEmbeddingProviderOptions) {
    if (options.apiKey.trim().length < 12) {
      throw new Error("OPENAI_API_KEY is required for adapter embeddings.");
    }
    this.model = options.model ?? DEFAULT_EMBEDDING_MODEL;
    this.#client = new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 10_000 });
  }

  public async embedRoutingText(text: string): Promise<readonly number[]> {
    const response = await this.#client.embeddings.create({
      model: this.model,
      input: text.slice(0, 8_000),
      encoding_format: "float",
      dimensions: ADAPTER_EMBEDDING_DIMENSIONS,
    });
    const embedding = response.data[0]?.embedding;
    if (
      !embedding ||
      embedding.length !== ADAPTER_EMBEDDING_DIMENSIONS ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("Embedding provider returned an invalid 1536-dimensional vector.");
    }
    return Object.freeze([...embedding]);
  }
}

export function createProductionArtifactSigner(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Ed25519ArtifactSigner {
  const privateKey = environment.MORPH_ADAPTER_SIGNING_PRIVATE_KEY_PEM;
  const keyId = environment.MORPH_ADAPTER_SIGNING_KEY_ID;
  if (!privateKey || !keyId) {
    throw new Error("Adapter signing key and key id are required for verified publication.");
  }
  return new Ed25519ArtifactSigner({
    privateKeyPem: privateKey.replaceAll("\\n", "\n"),
    keyId,
  });
}

export function createProductionEmbeddingProvider(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OpenAIAdapterEmbeddingProvider {
  const apiKey = environment.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for adapter embeddings.");
  return new OpenAIAdapterEmbeddingProvider({
    apiKey,
    ...(environment.OPENAI_EMBEDDING_MODEL === undefined
      ? {}
      : { model: environment.OPENAI_EMBEDDING_MODEL }),
  });
}

export interface AdapterForgePipelineDependencies {
  readonly generator: AdapterGenerator;
  readonly signer: ArtifactSigner;
  readonly embeddingProvider: AdapterEmbeddingProvider;
  readonly publisher: AdapterPublisher;
  readonly statusSink?: ForgeStatusSink;
  readonly codexProgressSink?: CodexProgressSink;
  readonly sandboxRoot?: string;
  readonly pipelineTimeoutMs?: number;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly validate?: (
    source: string,
    request: AdapterForgeRequest,
  ) => Promise<ForgeTestReport>;
  readonly createWorkspace?: (
    request: AdapterForgeRequest,
    options: { readonly sandboxRoot?: string },
  ) => Promise<EphemeralForgeWorkspace>;
}

export interface AdapterForgePipelineResult {
  readonly artifact: VerifiedAdapterArtifact;
  readonly attemptsUsed: number;
  readonly usedFallback: boolean;
}

export class AdapterForgeStoppedSafeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AdapterForgeStoppedSafeError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + " timed out.")), timeoutMs);
    timer.unref?.();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function surfaceFingerprint(request: AdapterForgeRequest): string {
  const stableSurface = {
    origin: new URL(request.origin).origin,
    taskFamily: request.taskFamily,
    records: request.surfaceRecords.map((record, ordinal) => ({
      ordinal,
      role: record.role,
      interactive: record.interactive,
      visible: record.visible,
      disabled: record.disabled,
    })),
    requiredActionOrdinals: request.requiredActionIds.map((requiredId) =>
      request.surfaceRecords.findIndex((record) => record.id === requiredId),
    ),
  };
  return sha256(JSON.stringify(stableSurface));
}

function routingText(request: AdapterForgeRequest): string {
  const roles = [...new Set(
    request.surfaceRecords
      .filter((record) => record.interactive && record.visible && !record.disabled)
      .map((record) => record.role ?? "unlabeled-control"),
  )].sort();
  return [
    "MORPH verified page adapter",
    "task-family: " + request.taskFamily,
    "domain-pattern: " + request.domainPattern,
    "locales: " + request.supportedLocales.slice().sort().join(","),
    "interactive-roles: " + roles.join(","),
  ].join("\n");
}

function safeAdapterName(taskFamily: string, artifactHash: string): string {
  const slug = taskFamily
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "page";
  return ("morph-" + slug + "-" + artifactHash.slice(0, 12)).slice(0, 120);
}

async function emitStatus(
  sink: ForgeStatusSink | undefined,
  now: () => Date,
  event: Omit<ForgeStatusEvent, "occurredAt">,
): Promise<void> {
  if (!sink) return;
  try {
    await sink(ForgeStatusEventSchema.parse({ ...event, occurredAt: now().toISOString() }));
  } catch {
    // Observability failure never changes the safety or publication decision.
  }
}

async function publishVerified(
  sourceCode: string,
  provenance: AdapterProvenance,
  report: ForgeTestReport,
  request: AdapterForgeRequest,
  dependencies: AdapterForgePipelineDependencies,
  now: () => Date,
  createId: () => string,
): Promise<VerifiedAdapterArtifact> {
  if (!report.passed) throw new Error("An unverified adapter cannot be published.");
  const artifactHash = sha256(sourceCode);
  const signature = await dependencies.signer.signArtifactHash(artifactHash);
  if (!(await dependencies.signer.verifyArtifactHash(artifactHash, signature))) {
    throw new Error("Adapter signature verification failed before persistence.");
  }
  const embedding = await withTimeout(
    dependencies.embeddingProvider.embedRoutingText(routingText(request)),
    ADAPTER_PUBLICATION_TIMEOUT_MS,
    "Adapter embedding",
  );
  if (
    embedding.length !== ADAPTER_EMBEDDING_DIMENSIONS ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Adapter embedding failed the closed pgvector boundary.");
  }

  const verifiedAt = now().toISOString();
  const adapter = AdapterSchema.parse({
    id: createId(),
    accessProfileId: request.accessProfileId,
    name: safeAdapterName(request.taskFamily, artifactHash),
    version: 1,
    status: "VERIFIED",
    taskFamily: request.taskFamily,
    domainPattern: request.domainPattern,
    supportedLocales: request.supportedLocales,
    capabilities: {
      observes: true,
      acts: true,
      supportsSimulation: true,
      requiresAuthentication: false,
    },
    minimumSurfaceSchemaVersion: 1,
    artifactHash,
    testReport: {
      unitPassed: report.unitPassed,
      browserPassed: report.browserPassed,
      accessibilityCriticalViolations: report.accessibilityCriticalViolations,
      policyPassed: report.policyPassed,
    },
    embeddingModel: dependencies.embeddingProvider.model,
    embeddingDimensions: ADAPTER_EMBEDDING_DIMENSIONS,
    createdAt: verifiedAt,
    verifiedAt,
  });

  const artifact: VerifiedAdapterArtifact = Object.freeze({
    adapter,
    sourceCode,
    signature,
    provenance,
    surfaceFingerprint: surfaceFingerprint(request),
    embedding: Object.freeze([...embedding]),
    validationReport: ForgeTestReportSchema.parse(report),
  });
  await withTimeout(
    dependencies.publisher.publish(artifact),
    ADAPTER_PUBLICATION_TIMEOUT_MS,
    "Adapter persistence",
  );
  return artifact;
}

function deadlineExceeded(startedAt: number, timeoutMs: number): boolean {
  return Date.now() - startedAt >= timeoutMs;
}

export async function forgeAdapter(
  rawRequest: unknown,
  dependencies: AdapterForgePipelineDependencies,
): Promise<AdapterForgePipelineResult> {
  const request = AdapterForgeRequestSchema.parse(rawRequest);
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? randomUUID;
  const validate = dependencies.validate ?? validateAdapterSource;
  const createWorkspace = dependencies.createWorkspace ?? createEphemeralForgeWorkspace;
  const timeoutMs = dependencies.pipelineTimeoutMs ?? DEFAULT_FORGE_PIPELINE_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 180_000) {
    throw new Error("Adapter Forge pipeline timeout must be between 5 and 180 seconds.");
  }

  const startedAt = Date.now();
  let attemptsUsed = 0;
  let failures: readonly string[] = ["Generation was not started."];
  let workspace: EphemeralForgeWorkspace | null = null;

  await emitStatus(dependencies.statusSink, now, {
    type: "ADAPTER_FORGE_ACTIVE",
    requestId: request.requestId,
    attempt: 1,
    detail: "Unknown surface isolated; Codex adapter generation started.",
  });

  try {
    workspace = await createWorkspace(request, {
      ...(dependencies.sandboxRoot === undefined
        ? {}
        : { sandboxRoot: dependencies.sandboxRoot }),
    });
    const session = await dependencies.generator.open(
      workspace,
      request,
      dependencies.codexProgressSink,
    );

    for (let attempt = 1; attempt <= MAX_FORGE_ATTEMPTS; attempt += 1) {
      attemptsUsed = attempt;
      if (deadlineExceeded(startedAt, timeoutMs)) {
        failures = ["Forge deadline reached before the next generation attempt."];
        break;
      }

      try {
        if (attempt === 1) {
          await session.generate();
        } else {
          await session.repair(failures);
        }
        const source = await workspace.readAdapterSource();
        await emitStatus(dependencies.statusSink, now, {
          type: "ADAPTER_FORGE_TESTING",
          requestId: request.requestId,
          attempt,
          detail: "Running policy, unit, Playwright, and axe-core gates.",
        });
        const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
        const report = await withTimeout(
          validate(source, request),
          Math.min(ADAPTER_VALIDATION_TIMEOUT_MS, remainingMs),
          "Adapter validation",
        );
        if (report.passed) {
          const artifact = await publishVerified(
            source,
            "CODEX_GENERATED",
            report,
            request,
            dependencies,
            now,
            createId,
          );
          await emitStatus(dependencies.statusSink, now, {
            type: "ADAPTER_FORGE_PUBLISHED",
            requestId: request.requestId,
            attempt,
            detail: "Verified adapter signed and published to semantic routing.",
          });
          return Object.freeze({ artifact, attemptsUsed, usedFallback: false });
        }
        failures = report.failures.length > 0
          ? report.failures
          : ["Independent adapter validation failed without a diagnostic."];
      } catch (error) {
        failures = [conciseFailure(error)];
      }

      if (attempt < MAX_FORGE_ATTEMPTS && !deadlineExceeded(startedAt, timeoutMs)) {
        await emitStatus(dependencies.statusSink, now, {
          type: "ADAPTER_FORGE_REPAIRING",
          requestId: request.requestId,
          attempt: attempt + 1,
          detail: "Bounded test diagnostics returned to Codex for self-repair.",
        });
      }
    }
  } catch (error) {
    attemptsUsed = Math.max(1, attemptsUsed);
    failures = [conciseFailure(error)];
  } finally {
    if (workspace !== null) await workspace.cleanup();
  }

  await emitStatus(dependencies.statusSink, now, {
    type: "ADAPTER_FORGE_FALLBACK",
    requestId: request.requestId,
    attempt: attemptsUsed,
    detail: "Live generation unavailable; activating the deterministic prebuilt adapter.",
  });

  let fallbackReport: ForgeTestReport;
  try {
    fallbackReport = await withTimeout(
      validate(PREVALIDATED_FALLBACK_SOURCE, request),
      ADAPTER_VALIDATION_TIMEOUT_MS,
      "Prebuilt adapter validation",
    );
  } catch (error) {
    await emitStatus(dependencies.statusSink, now, {
      type: "ADAPTER_FORGE_STOPPED_SAFE",
      requestId: request.requestId,
      attempt: attemptsUsed,
      detail: "Prebuilt validation timed out or failed; execution stopped safely.",
    });
    throw new AdapterForgeStoppedSafeError(conciseFailure(error));
  }
  if (!fallbackReport.passed) {
    await emitStatus(dependencies.statusSink, now, {
      type: "ADAPTER_FORGE_STOPPED_SAFE",
      requestId: request.requestId,
      attempt: attemptsUsed,
      detail: "Prebuilt adapter did not match this surface; execution stopped safely.",
    });
    throw new AdapterForgeStoppedSafeError(
      "Generated and prebuilt adapters failed closed: " +
        [...failures, ...fallbackReport.failures].slice(0, 6).join(" | "),
    );
  }

  try {
    const artifact = await publishVerified(
      PREVALIDATED_FALLBACK_SOURCE,
      "PREBUILT_FALLBACK",
      fallbackReport,
      request,
      dependencies,
      now,
      createId,
    );
    await emitStatus(dependencies.statusSink, now, {
      type: "ADAPTER_FORGE_PUBLISHED",
      requestId: request.requestId,
      attempt: attemptsUsed,
      detail: "Prebuilt adapter revalidated, signed, and published without blocking the demo.",
    });
    return Object.freeze({ artifact, attemptsUsed, usedFallback: true });
  } catch (error) {
    await emitStatus(dependencies.statusSink, now, {
      type: "ADAPTER_FORGE_STOPPED_SAFE",
      requestId: request.requestId,
      attempt: attemptsUsed,
      detail: "Adapter publication failed closed; no unsigned artifact was stored.",
    });
    throw new AdapterForgeStoppedSafeError(conciseFailure(error));
  }
}
