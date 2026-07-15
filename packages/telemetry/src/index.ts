export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 1;
  readonly status: "scaffolded";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/telemetry",
  phase: 1,
  status: "scaffolded",
  responsibility: "Own redacted events, safe traces, latency, token, and verification measurements.",
});
