export interface LayoutVariant {
  readonly id: number;
  readonly name: string;
  readonly className: string;
  readonly promo: string;
  readonly dateControl: "CALENDAR" | "TEXT";
  readonly resultOrder: readonly string[];
}

export const LAYOUT_VARIANTS = Object.freeze([
  {
    id: 0,
    name: "Dense grid",
    className: "variant-dense-grid",
    promo: "FLASH FARE: 07:42 REMAINING",
    dateControl: "CALENDAR",
    resultOrder: ["SD-482", "SD-211", "SD-903"],
  },
  {
    id: 1,
    name: "Sidebar flip",
    className: "variant-sidebar-flip",
    promo: "MEMBER PRICE UNLOCKED*",
    dateControl: "TEXT",
    resultOrder: ["SD-211", "SD-903", "SD-482"],
  },
  {
    id: 2,
    name: "Banner stack",
    className: "variant-banner-stack",
    promo: "ONLY 2 SEATS MAYBE LEFT",
    dateControl: "CALENDAR",
    resultOrder: ["SD-903", "SD-482", "SD-211"],
  },
  {
    id: 3,
    name: "Card reversal",
    className: "variant-card-reversal",
    promo: "PRICE CHANGED WHILE YOU LOOKED",
    dateControl: "TEXT",
    resultOrder: ["SD-482", "SD-903", "SD-211"],
  },
  {
    id: 4,
    name: "Floating filters",
    className: "variant-floating-filters",
    promo: "ADD FLEX+ AND SAVE LATER",
    dateControl: "CALENDAR",
    resultOrder: ["SD-211", "SD-482", "SD-903"],
  },
] as const satisfies readonly LayoutVariant[]);

interface VariantStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveLayoutVariant(search: string, storage: VariantStorage): LayoutVariant {
  const requested = Number(new URLSearchParams(search).get("variant"));
  if (Number.isInteger(requested) && requested >= 0 && requested < LAYOUT_VARIANTS.length) {
    return LAYOUT_VARIANTS[requested]!;
  }

  const previous = Number(storage.getItem("morph-demo-portal-variant") ?? "-1");
  const next = Number.isInteger(previous) ? (previous + 1) % LAYOUT_VARIANTS.length : 0;
  storage.setItem("morph-demo-portal-variant", String(next));
  return LAYOUT_VARIANTS[next]!;
}
