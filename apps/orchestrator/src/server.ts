import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Pool } from "pg";
import {
  createDemoMutationResponse,
  PostgresDemoMutationWriter,
} from "./demo-mutation.js";
import {
  createSessionEventStream,
  PostgresSessionEventReader,
} from "./stream.js";
const STREAM_ROUTE = /^[/]v1[/]sessions[/]([0-9a-f-]+)[/]events$/i;
const MUTATION_ROUTE = /^[/]v1[/]demo[/]sessions[/]([0-9a-f-]+)[/]mutate$/i;
const MAX_REQUEST_BODY_BYTES = 2_048;
export interface OrchestratorServerEnvironment {
  readonly DATABASE_URL?: string;
  readonly MORPH_STREAM_AUTH_TOKEN?: string;
  readonly MORPH_DEMO_SESSION_ID?: string;
  readonly MORPH_WEB_ORIGIN?: string;
  readonly ORCHESTRATOR_PORT?: string;
}
function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return null;
  }
  for (const segment of cookie.split(";")) {
    const [key, ...rest] = segment.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}
async function readBody(request: IncomingMessage): Promise<Uint8Array | undefined> {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_REQUEST_BODY_BYTES) {
      throw new Error("Request body exceeds the orchestrator boundary");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
async function toWebRequest(
  request: IncomingMessage,
  abortController: AbortController,
): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    }
  }
  const body = await readBody(request);
  const init: RequestInit = {
    method: request.method ?? "GET",
    headers,
    signal: abortController.signal,
  };
  if (body !== undefined) {
    init.body = new TextDecoder().decode(body);
  }
  const host = request.headers.host ?? "127.0.0.1";
  return new Request("http://" + host + (request.url ?? "/"), init);
}
async function sendWebResponse(response: Response, output: ServerResponse): Promise<void> {
  output.statusCode = response.status;
  response.headers.forEach((value, name) => output.setHeader(name, value));
  if (!response.body) {
    output.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (!output.destroyed) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      if (!output.write(Buffer.from(chunk.value))) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    if (!output.destroyed) {
      output.end();
    }
  }
}
export function startOrchestratorServer(
  environment: OrchestratorServerEnvironment = process.env as OrchestratorServerEnvironment,
) {
  const connectionString = environment.DATABASE_URL;
  const authToken = environment.MORPH_STREAM_AUTH_TOKEN;
  const demoSessionId = environment.MORPH_DEMO_SESSION_ID;
  if (!connectionString || !authToken || authToken.length < 32 || !demoSessionId) {
    throw new Error(
      "Live orchestrator requires DATABASE_URL, MORPH_DEMO_SESSION_ID, and a 32+ character MORPH_STREAM_AUTH_TOKEN.",
    );
  }
  const portValue = Number(environment.ORCHESTRATOR_PORT);
  const port = Number.isInteger(portValue) && portValue > 0 ? portValue : 8788;
  const allowedOrigin = environment.MORPH_WEB_ORIGIN ?? "http://127.0.0.1:3000";
  const pool = new Pool({
    connectionString,
    application_name: "morph-orchestrator",
    options: "-c statement_timeout=5000",
    max: 10,
  });
  const reader = new PostgresSessionEventReader(pool);
  const writer = new PostgresDemoMutationWriter(pool);
  const authorizeSession = (request: Request, sessionId: string) => {
    const cookie = cookieValue(request, "morph_stream");
    return sessionId === demoSessionId && cookie !== null && equalSecret(cookie, authToken);
  };
  const server = createServer((incoming, outgoing) => {
    const abortController = new AbortController();
    incoming.once("close", () => abortController.abort());
    void (async () => {
      try {
        const request = await toWebRequest(incoming, abortController);
        const pathname = new URL(request.url).pathname;
        const streamMatch = STREAM_ROUTE.exec(pathname);
        const mutationMatch = MUTATION_ROUTE.exec(pathname);
        let response: Response;
        if (streamMatch && request.method === "GET") {
          response = await createSessionEventStream(request, streamMatch[1]!, {
            reader,
            authorizeSession,
            allowedOrigin,
          });
        } else if (mutationMatch) {
          response = await createDemoMutationResponse(request, mutationMatch[1]!, {
            writer,
            authorizeSession,
            allowedOrigin,
          });
        } else {
          response = new Response("Not found", { status: 404 });
        }
        await sendWebResponse(response, outgoing);
      } catch {
        if (!outgoing.headersSent) {
          outgoing.statusCode = 500;
          outgoing.end("Orchestrator stopped the request safely");
        } else {
          outgoing.destroy();
        }
      }
    })();
  });
  server.listen(port, "127.0.0.1");
  server.once("close", () => {
    void pool.end();
  });
  return server;
}