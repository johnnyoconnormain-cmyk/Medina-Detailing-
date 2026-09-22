import type { businesses, services } from "@/db/schema";
import type { LeadAnalysis } from "./adapters/ai";

type Business = typeof businesses.$inferSelect;
type Service = typeof services.$inferSelect;

export type EstimateResult = {
  lowCents: number;
  highCents: number;
  /** Every number that fed the range, so the owner can see why — and override it. */
  breakdown: Array<{ label: string; detail: string; cents: number }>;
  basis: string;
  confident: boolean;
};

const SIZE_MULTIPLIER = { small: 0.7, medium: 1, large: 1.55 } as const;

/**
 * Produces an estimate RANGE from the owner's own pricing configuration.
 *
 * Deliberately not a prediction of the true price. It is arithmetic over rates
 * the owner set: hourly rate x typical hours, plus base price, plus markup,
 * plus travel, floored at the minimum job price, widened by the owner's own
 * low/high percentages. The customer is always told the final price is
 * confirmed on inspection, and the owner can override every number.
 */
export function estimateForService(
  business: Business,
  service: Service,
  analysis?: Pick<LeadAnalysis, "sizeSignal" | "confidence"> | null,
): EstimateResult {
  const breakdown: EstimateResult["breakdown"] = [];

  const sizeMult = analysis?.sizeSignal ? SIZE_MULTIPLIER[analysis.sizeSignal] : 1;
  const hours = service.typicalHours * sizeMult;
  const labor = Math.round(business.hourlyRateCents * hours);

  breakdown.push({
    label: "Labor",
    detail: `${hours.toFixed(1)} hrs @ $${(business.hourlyRateCents / 100).toFixed(0)}/hr`,
    cents: labor,
  });

  let subtotal = labor;

  if (service.basePriceCents > 0) {
    const base = Math.round(service.basePriceCents * sizeMult);
    breakdown.push({ label: "Materials & base", detail: `${service.name} base rate`, cents: base });
    subtotal += base;
  }

  if (business.materialMarkupPct > 0 && service.basePriceCents > 0) {
    const markup = Math.round(service.basePriceCents * sizeMult * (business.materialMarkupPct / 100));
    breakdown.push({ label: "Material markup", detail: `${business.materialMarkupPct}%`, cents: markup });
    subtotal += markup;
  }

  if (business.travelFeeCents > 0) {
    breakdown.push({ label: "Travel", detail: "Flat trip charge", cents: business.travelFeeCents });
    subtotal += business.travelFeeCents;
  }

  const floor = Math.max(business.minimumJobCents, service.minPriceCents ?? 0);
  let flooredNote: string | null = null;
  if (subtotal < floor) {
    flooredNote = `Raised to the $${(floor / 100).toFixed(0)} job minimum`;
    subtotal = floor;
  }
  if (flooredNote) breakdown.push({ label: "Job minimum", detail: flooredNote, cents: 0 });

  const low = roundTo(subtotal * (service.estimateLowPct / 100), 2500);
  const high = roundTo(subtotal * (service.estimateHighPct / 100), 2500);

  return {
    lowCents: Math.max(low, floor),
    highCents: Math.max(high, low + 5000),
    breakdown,
    basis: analysis?.sizeSignal
      ? `Based on your rates and a ${analysis.sizeSignal} job scope`
      : "Based on your configured rates and typical job duration",
    // Below this threshold the UI shows the range without a service guess attached.
    confident: (analysis?.confidence ?? 0) >= 0.5,
  };
}

/** Round to the nearest $25 so estimates read as estimates, not false precision. */
function roundTo(cents: number, step: number): number {
  return Math.round(cents / step) * step;
}

export function formatRange(low: number, high: number): string {
  const f = (c: number) => `$${Math.round(c / 100).toLocaleString("en-US")}`;
  return `${f(low)}–${f(high)}`;
}
