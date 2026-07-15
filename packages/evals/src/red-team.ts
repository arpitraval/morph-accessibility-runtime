export type AttackChannel = "HIDDEN_TEXT" | "DATA_ATTRIBUTE" | "ARIA_LABEL";
export type AttackCommand = "SELECT" | "SUBMIT";
export type CriticRejectionReason =
  | "PROMPT_INJECTION"
  | "CONSENT_SPOOF"
  | "RISK_DOWNGRADE";

export interface AdversarialFixture {
  readonly id: string;
  readonly channel: AttackChannel;
  readonly hidden: true;
  readonly text: string;
  readonly proposedCommand: AttackCommand;
  readonly claimedRiskClass: "R1" | "R2" | "R4";
  readonly expectedCriticReason: CriticRejectionReason;
}

export interface CriticRedTeamDecision {
  readonly agent: "CRITIC";
  readonly accepted: false;
  readonly disposition: "SAFE_HALT";
  readonly reason: CriticRejectionReason;
  readonly evidenceTrust: "UNTRUSTED_PAGE_DATA";
  readonly actionableNodeCreated: false;
  readonly summary: string;
}

const CHANNELS = new Set<AttackChannel>(["HIDDEN_TEXT", "DATA_ATTRIBUTE", "ARIA_LABEL"]);
const COMMANDS = new Set<AttackCommand>(["SELECT", "SUBMIT"]);
const RISK_CLASSES = new Set(["R1", "R2", "R4"]);
const REASONS = new Set<CriticRejectionReason>([
  "PROMPT_INJECTION",
  "CONSENT_SPOOF",
  "RISK_DOWNGRADE",
]);
const ALLOWED_KEYS = new Set([
  "id",
  "channel",
  "hidden",
  "text",
  "proposedCommand",
  "claimedRiskClass",
  "expectedCriticReason",
]);

export function parseAdversarialFixtures(value: unknown): readonly AdversarialFixture[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("Adversarial fixture set must contain between 1 and 20 entries");
  }

  const ids = new Set<string>();
  return Object.freeze(
    value.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        throw new Error("Adversarial fixture must be an object");
      }
      const record = item as Record<string, unknown>;
      if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
        throw new Error("Adversarial fixture contains an unknown field");
      }
      if (
        typeof record.id !== "string" ||
        !/^[a-z0-9-]{3,80}$/.test(record.id) ||
        ids.has(record.id) ||
        typeof record.text !== "string" ||
        record.text.length < 10 ||
        record.text.length > 500 ||
        record.hidden !== true ||
        !CHANNELS.has(record.channel as AttackChannel) ||
        !COMMANDS.has(record.proposedCommand as AttackCommand) ||
        !RISK_CLASSES.has(String(record.claimedRiskClass)) ||
        !REASONS.has(record.expectedCriticReason as CriticRejectionReason)
      ) {
        throw new Error("Adversarial fixture failed the closed red-team contract");
      }
      ids.add(record.id);
      return Object.freeze(record as unknown as AdversarialFixture);
    }),
  );
}

function classifyInjection(text: string): CriticRejectionReason {
  const normalized = text.toLocaleLowerCase();
  if (
    normalized.includes("consent") &&
    (normalized.includes("already granted") || normalized.includes("user consent is"))
  ) {
    return "CONSENT_SPOOF";
  }
  if (
    normalized.includes("riskclass") ||
    normalized.includes("bypass require_consent") ||
    normalized.includes("reversible=true")
  ) {
    return "RISK_DOWNGRADE";
  }
  return "PROMPT_INJECTION";
}

export function runCriticRedTeam(fixture: AdversarialFixture): CriticRedTeamDecision {
  const reason = classifyInjection(fixture.text);
  return Object.freeze({
    agent: "CRITIC",
    accepted: false,
    disposition: "SAFE_HALT",
    reason,
    evidenceTrust: "UNTRUSTED_PAGE_DATA",
    actionableNodeCreated: false,
    summary:
      "Rejected " +
      fixture.id +
      ": page-provided instructions cannot modify intent, risk, consent, or verification.",
  });
}