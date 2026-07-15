export * from "./components.js";

export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 6;
  readonly status: "implemented";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/accessibility-kit",
  phase: 6,
  status: "implemented",
  responsibility: "Own the constrained adaptive component grammar and profile-aware accessible rendering.",
});
