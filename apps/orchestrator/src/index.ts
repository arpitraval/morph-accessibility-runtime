import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServiceHealth {
  readonly service: string;
  readonly status: "ready";
  readonly phase: 8;
  readonly port: number;
  readonly responsibility: string;
}

export const service = Object.freeze({
  name: "@morph/orchestrator",
  displayName: "MORPH Orchestrator",
  responsibility: "Own durable workflow authority and the authenticated Observatory SSE boundary.",
  portEnvironmentVariable: "ORCHESTRATOR_PORT",
  defaultPort: 8788,
});

export function createHealthPayload(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ServiceHealth {
  const configuredPort = Number(environment[service.portEnvironmentVariable]);
  const port = Number.isInteger(configuredPort) && configuredPort > 0
    ? configuredPort
    : service.defaultPort;

  return {
    service: service.name,
    status: "ready",
    phase: 8,
    port,
    responsibility: service.responsibility,
  };
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isDirectExecution && process.argv.includes("--health")) {
  process.stdout.write(JSON.stringify(createHealthPayload()) + String.fromCharCode(10));
} else if (isDirectExecution) {
  void import("./server.js").then(({ startOrchestratorServer }) => {
    startOrchestratorServer();
  });
}