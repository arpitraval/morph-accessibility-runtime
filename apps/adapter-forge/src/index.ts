export * from "./forge.js";
export * from "./harness.js";
export * from "./pipeline.js";

export interface ServiceHealth {
  readonly service: string;
  readonly status: "ready";
  readonly phase: 7;
  readonly port: number;
  readonly responsibility: string;
}

export const service = Object.freeze({
  name: "@morph/adapter-forge",
  displayName: "MORPH Adapter Forge",
  responsibility:
    "Generate, independently verify, sign, and publish isolated page adapters with a deterministic fallback.",
  portEnvironmentVariable: "ADAPTER_FORGE_PORT",
  defaultPort: 8792,
});

export function createHealthPayload(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ServiceHealth {
  const configuredPort = Number(environment[service.portEnvironmentVariable]);
  const port =
    Number.isInteger(configuredPort) && configuredPort > 0
      ? configuredPort
      : service.defaultPort;

  return {
    service: service.name,
    status: "ready",
    phase: 7,
    port,
    responsibility: service.responsibility,
  };
}

if (process.argv.includes("--health")) {
  process.stdout.write(`${JSON.stringify(createHealthPayload())}\n`);
}
