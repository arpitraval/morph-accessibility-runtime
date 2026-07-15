export * from "./executor.js";
export * from "./verifier.js";
export * from "./worker.js";

export interface ServiceHealth {
  readonly service: string;
  readonly status: "ready";
  readonly phase: 5;
  readonly port: number;
  readonly responsibility: string;
}

export const service = Object.freeze({
  name: "@morph/browser-worker",
  displayName: "MORPH Browser Worker",
  responsibility: "Own isolated capture, one-step browser execution, and fresh verification.",
  portEnvironmentVariable: "BROWSER_WORKER_PORT",
  defaultPort: 8790,
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
    phase: 5,
    port,
    responsibility: service.responsibility,
  };
}

if (process.argv.includes("--health")) {
  process.stdout.write(`${JSON.stringify(createHealthPayload())}\n`);
}
