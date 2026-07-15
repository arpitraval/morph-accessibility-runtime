import { AgentEventSchema, ObservatoryEventSchema } from "@morph/contracts";
import type { AgentEvent, ObservatoryEvent } from "@morph/contracts";
import type { Pool } from "pg";

const encoder = new TextEncoder();
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const PUBLIC_EVENT_NAME = "observatory";

export class UnsafeSessionEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeSessionEventError";
  }
}

export interface SessionEventReader {
  readAfter(
    sessionId: string,
    sequence: number,
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly unknown[]>;
}

export class PostgresSessionEventReader implements SessionEventReader {
  constructor(private readonly pool: Pool) {}

  async readAfter(
    sessionId: string,
    sequence: number,
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly unknown[]> {
    if (signal.aborted) {
      return [];
    }

    const result = await this.pool.query<{ payload: unknown }>({
      text: [
        "SELECT payload",
        "FROM session_events",
        "WHERE session_id = $1 AND sequence > $2",
        "ORDER BY sequence ASC",
        "LIMIT $3",
      ].join(" "),
      values: [sessionId, sequence, limit],
    });

    if (signal.aborted) {
      return [];
    }
    return result.rows.map((row) => row.payload);
  }
}

export type SessionStreamAuthorizer = (
  request: Request,
  sessionId: string,
) => boolean | Promise<boolean>;

export interface SessionStreamDependencies {
  readonly reader: SessionEventReader;
  readonly authorizeSession: SessionStreamAuthorizer;
  readonly batchSize?: number;
  readonly pollIntervalMs?: number;
  readonly heartbeatIntervalMs?: number;
  readonly allowedOrigin?: string;
  readonly onSubscriberClosed?: () => void;
}

const PUBLIC_REDACTION = Object.freeze({
  reasoningExcluded: true as const,
  rawModelOutputExcluded: true as const,
});

function common(event: AgentEvent) {
  return {
    sessionId: event.sessionId,
    sequence: event.sequence,
    eventId: event.id,
    occurredAt: event.occurredAt,
    redaction: PUBLIC_REDACTION,
  };
}

/**
 * Projects a strict durable event into a second strict, allowlisted public shape.
 * It never spreads database payloads, so private reasoning and raw model output
 * cannot cross the stream boundary.
 */
export function projectSessionEvent(value: unknown): ObservatoryEvent | null {
  const parsed = AgentEventSchema.safeParse(value);
  if (!parsed.success) {
    throw new UnsafeSessionEventError("Durable session event failed the closed AgentEvent contract");
  }

  const event = parsed.data;
  let projection: ObservatoryEvent | null;

  switch (event.type) {
    case "STATE_TRANSITIONED":
      projection = {
        ...common(event),
        kind: "STATE_TRANSITION",
        data: {
          from: event.data.from,
          to: event.data.to,
          reason: event.data.reason,
          detail: event.data.detail,
        },
      };
      break;
    case "AGENT_ACTIVITY_RECORDED":
      projection = {
        ...common(event),
        kind: "AGENT_ACTIVITY",
        data: {
          agent: event.data.agent,
          status: event.data.status,
          toolName: event.data.toolName,
          summary: event.data.summary,
          evidenceIds: [...event.data.evidenceIds],
        },
      };
      break;
    case "CANDIDATE_PLAN_RECORDED":
      projection = {
        ...common(event),
        kind: "CANDIDATE_PLAN",
        data: {
          planId: event.data.planId,
          candidateKey: event.data.candidateKey,
          rank: event.data.rank,
          status: event.data.status,
          summary: event.data.summary,
          constraintResults: event.data.constraintResults.map((result) => ({ ...result })),
        },
      };
      break;
    case "HYPOTHESIS_REJECTED":
      projection = {
        ...common(event),
        kind: "HYPOTHESIS_REJECTED",
        data: {
          agent: "CRITIC",
          hypothesisId: event.data.hypothesisId,
          summary: event.data.summary,
          reasonCode: event.data.reasonCode,
          evidenceIds: [...event.data.evidenceIds],
        },
      };
      break;
    case "VERIFICATION_EVIDENCE_RECORDED":
      projection = {
        ...common(event),
        kind: "VERIFICATION_EVIDENCE",
        data: {
          verificationResultId: event.data.verificationResultId,
          actionStepId: event.data.actionStepId,
          outcome: event.data.outcome,
          summary: event.data.summary,
          evidence: event.data.evidence.map((evidence) => ({ ...evidence })),
        },
      };
      break;
    case "VERIFICATION_RECORDED":
      projection = {
        ...common(event),
        kind: "VERIFICATION_EVIDENCE",
        data: {
          verificationResultId: event.data.verificationResultId,
          actionStepId: event.data.actionStepId,
          outcome: event.data.outcome,
          summary: "Deterministic verification finished with " + event.data.outcome.toLowerCase() + ".",
          evidence: [],
        },
      };
      break;
    case "ADAPTER_FORGE_STATUS_RECORDED":
      projection = {
        ...common(event),
        kind: "ADAPTER_FORGE_STATUS",
        data: { ...event.data },
      };
      break;
    default:
      projection = null;
  }

  return projection === null ? null : ObservatoryEventSchema.parse(projection);
}

export function encodeObservatoryEvent(event: ObservatoryEvent): Uint8Array {
  const safeEvent = ObservatoryEventSchema.parse(event);
  return encoder.encode(
    "id: " + safeEvent.sequence + "\nevent: " + PUBLIC_EVENT_NAME +
      "\ndata: " + JSON.stringify(safeEvent) + "\n\n",
  );
}

function parseCursor(request: Request): number {
  const url = new URL(request.url);
  const raw = request.headers.get("last-event-id") ?? url.searchParams.get("after") ?? "0";
  const cursor = Number(raw);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
}

function positiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isSafeInteger(value) && value !== undefined && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export async function createSessionEventStream(
  request: Request,
  sessionId: string,
  dependencies: SessionStreamDependencies,
): Promise<Response> {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return new Response("Invalid session id", { status: 400 });
  }

  if (!(await dependencies.authorizeSession(request, sessionId))) {
    return new Response("Forbidden", { status: 403 });
  }

  const batchSize = positiveInteger(dependencies.batchSize, DEFAULT_BATCH_SIZE, 500);
  const pollIntervalMs = positiveInteger(
    dependencies.pollIntervalMs,
    DEFAULT_POLL_INTERVAL_MS,
    10_000,
  );
  const heartbeatIntervalMs = positiveInteger(
    dependencies.heartbeatIntervalMs,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    60_000,
  );
  const localAbort = new AbortController();
  const onRequestAbort = () => localAbort.abort();
  request.signal.addEventListener("abort", onRequestAbort, { once: true });

  let cursor = parseCursor(request);
  let closed = false;
  const closeSubscriber = () => {
    if (closed) {
      return;
    }
    closed = true;
    request.signal.removeEventListener("abort", onRequestAbort);
    localAbort.abort();
    dependencies.onSubscriberClosed?.();
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        let lastHeartbeat = Date.now();
        try {
          controller.enqueue(encoder.encode("retry: 1500\n\n"));

          while (!localAbort.signal.aborted) {
            const batch = await dependencies.reader.readAfter(
              sessionId,
              cursor,
              batchSize,
              localAbort.signal,
            );

            for (const rawEvent of batch) {
              if (localAbort.signal.aborted) {
                break;
              }
              const parsed = AgentEventSchema.safeParse(rawEvent);
              if (!parsed.success) {
                throw new UnsafeSessionEventError(
                  "Durable session event failed the closed AgentEvent contract",
                );
              }
              if (parsed.data.sessionId !== sessionId || parsed.data.sequence <= cursor) {
                throw new UnsafeSessionEventError("Session event cursor or ownership mismatch");
              }

              cursor = parsed.data.sequence;
              const publicEvent = projectSessionEvent(parsed.data);
              if (publicEvent) {
                while (
                  controller.desiredSize !== null &&
                  controller.desiredSize <= 0 &&
                  !localAbort.signal.aborted
                ) {
                  await abortableDelay(pollIntervalMs, localAbort.signal);
                }
                if (!localAbort.signal.aborted) {
                  controller.enqueue(encodeObservatoryEvent(publicEvent));
                }
              }
            }

            const now = Date.now();
            if (now - lastHeartbeat >= heartbeatIntervalMs) {
              controller.enqueue(encoder.encode(": heartbeat " + now + "\n\n"));
              lastHeartbeat = now;
            }

            if (batch.length < batchSize) {
              await abortableDelay(pollIntervalMs, localAbort.signal);
            }
          }

          controller.close();
        } catch (error) {
          if (!localAbort.signal.aborted) {
            controller.error(
              error instanceof UnsafeSessionEventError
                ? error
                : new Error("Session event stream stopped safely"),
            );
          }
        } finally {
          closeSubscriber();
        }
      })();
    },
    cancel() {
      closeSubscriber();
    },
  });

  const headers = new Headers({
    "cache-control": "no-cache, no-store, no-transform",
    connection: "keep-alive",
    "content-type": "text/event-stream; charset=utf-8",
    "x-accel-buffering": "no",
  });
  const requestOrigin = request.headers.get("origin");
  if (dependencies.allowedOrigin && requestOrigin === dependencies.allowedOrigin) {
    headers.set("access-control-allow-origin", dependencies.allowedOrigin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "origin");
  }

  return new Response(body, { headers });
}