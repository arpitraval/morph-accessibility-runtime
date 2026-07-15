export * from "./red-team.js";
export * from "./runner.js";

export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 9;
  readonly status: "implemented";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/evals",
  phase: 9,
  status: "implemented",
  responsibility:
    "Own reproducible scenario matrices, safety-fatal metrics, adversarial fixtures, and CI evaluation gates.",
});