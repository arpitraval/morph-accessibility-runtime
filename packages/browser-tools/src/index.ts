export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 1;
  readonly status: "scaffolded";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/browser-tools",
  phase: 1,
  status: "scaffolded",
  responsibility: "Own typed target observations, action commands, evidence, and browser isolation boundaries.",
});
