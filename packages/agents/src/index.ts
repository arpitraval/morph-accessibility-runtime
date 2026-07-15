export * from "./client.js";
export * from "./prompts.js";
export * from "./tools.js";

export interface PackageDescriptor {
  readonly name: string;
  readonly phase: 4;
  readonly status: "implemented";
  readonly responsibility: string;
}

export const packageDescriptor: PackageDescriptor = Object.freeze({
  name: "@morph/agents",
  phase: 4,
  status: "implemented",
  responsibility:
    "Own GPT-5.6 Sol Responses calls, versioned prompts, closed outputs, programmatic tools, and bounded routing.",
});
