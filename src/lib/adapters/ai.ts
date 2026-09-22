import "server-only";

/**
 * Language/vision seam.
 *
 * The brief is that AI stays invisible and never fabricates. So this module
 * exposes narrow, checkable jobs — classify a request, summarise it, score
 * urgency, draft a message — rather than a chat surface.
 *
 * The active implementation is deterministic keyword analysis. That is a
 * deliberate choice, not a placeholder: it runs offline, costs nothing, returns
 * the same answer twice, and is auditable when an owner asks why a lead was
 * tagged urgent. `confidence` is reported honestly so the UI can stay quiet
 * when the signal is weak.
 *
 * Swapping in a model means implementing this interface and returning it from
 * getIntelligence(); no caller changes.
 */

export type ServiceGuess = { serviceKey: string; confidence: number };
export type LeadAnalysis = {
  serviceGuess: ServiceGuess | null;
  summary: string;
  urgencyScore: number;          // 0-100
  urgencyReason: string | null;
  sizeSignal: "small" | "medium" | "large" | null;
  confidence: number;            // 0-1 across the whole analysis
};

export interface IntelligenceProvider {
  readonly name: string;
  readonly isModelBacked: boolean;
  analyzeLead(input: { text: string; serviceNames: string[] }): Promise<LeadAnalysis>;
  draftFollowUp(input: { customerName: string; businessName: string; quoteTitle: string; totalCents: number; attempt: number }): Promise<string>;
}

/* Keyword tables. Ordered by specificity — first strong hit wins. */
const SERVICE_SIGNALS: Array<{ key: string; terms: string[] }> = [
  { key: "irrigation", terms: ["irrigation", "sprinkler", "drip line", "backflow", "zone valve", "watering system"] },
  { key: "mulch", terms: ["mulch", "bark", "wood chips", "top dress", "mulching"] },
  { key: "cleanup", terms: ["cleanup", "clean up", "clean-up", "overgrown", "brush", "debris", "leaves", "leaf removal", "haul away", "junk", "weeds", "weeding", "tidy"] },
  { key: "hardscape", terms: ["patio", "paver", "retaining wall", "walkway", "stone", "fire pit", "hardscape"] },
  { key: "tree", terms: ["tree", "prune", "pruning", "trim branches", "stump", "limb", "hedge", "shrub"] },
  { key: "sod", terms: ["sod", "seeding", "reseed", "new lawn", "turf", "aerate", "aeration", "overseed"] },
  { key: "design", terms: ["design", "landscape plan", "redesign", "flower bed", "planting", "garden bed", "plants"] },
  { key: "maintenance", terms: ["mow", "mowing", "lawn care", "weekly", "biweekly", "bi-weekly", "maintenance", "edging", "recurring"] },
];

const URGENCY_SIGNALS: Array<{ terms: string[]; weight: number; reason: string }> = [
  { terms: ["asap", "urgent", "emergency", "immediately", "right away"], weight: 45, reason: "Asked for immediate service" },
  { terms: ["this week", "by friday", "by saturday", "few days", "before the weekend"], weight: 30, reason: "Named a near-term deadline" },
  { terms: ["selling", "listing", "open house", "realtor", "on the market"], weight: 35, reason: "Tied to a home sale" },
  { terms: ["party", "wedding", "event", "graduation", "guests coming"], weight: 30, reason: "Hosting an event" },
  { terms: ["hoa", "violation", "citation", "fine", "code enforcement"], weight: 40, reason: "Facing an HOA or code issue" },
  { terms: ["quote", "estimate", "how much", "pricing", "price"], weight: 10, reason: "Explicitly asked for a price" },
  { terms: ["another company", "other quotes", "comparing", "shopping around"], weight: 25, reason: "Comparing against competitors" },
];

const SIZE_SIGNALS: Array<{ terms: string[]; size: "small" | "medium" | "large" }> = [
  { terms: ["small", "tiny", "little", "just a", "one bed", "quick"], size: "small" },
  { terms: ["whole yard", "entire", "full property", "acre", "large", "big", "huge", "everything"], size: "large" },
  { terms: ["backyard", "front yard", "side yard", "a few"], size: "medium" },
];

function countHits(haystack: string, terms: string[]): number {
  return terms.reduce((n, t) => (haystack.includes(t) ? n + 1 : n), 0);
}

class KeywordIntelligence implements IntelligenceProvider {
  readonly name = "keyword-heuristics";
  readonly isModelBacked = false;

  async analyzeLead(input: { text: string; serviceNames: string[] }): Promise<LeadAnalysis> {
    const text = ` ${input.text.toLowerCase()} `;

    let best: ServiceGuess | null = null;
    for (const sig of SERVICE_SIGNALS) {
      const hits = countHits(text, sig.terms);
      if (hits === 0) continue;
      const confidence = Math.min(0.9, 0.45 + hits * 0.18);
      if (!best || confidence > best.confidence) best = { serviceKey: sig.key, confidence };
    }

    let urgency = 12; // a fresh inbound lead is never truly zero-urgency
    const reasons: string[] = [];
    for (const sig of URGENCY_SIGNALS) {
      if (countHits(text, sig.terms) > 0) { urgency += sig.weight; reasons.push(sig.reason); }
    }
    urgency = Math.max(0, Math.min(100, urgency));

    let sizeSignal: "small" | "medium" | "large" | null = null;
    for (const sig of SIZE_SIGNALS) {
      if (countHits(text, sig.terms) > 0) { sizeSignal = sig.size; break; }
    }

    return {
      serviceGuess: best,
      summary: this.summarize(input.text),
      urgencyScore: urgency,
      urgencyReason: reasons[0] ?? null,
      sizeSignal,
      // Weak evidence must read as weak; the UI hides low-confidence hints.
      confidence: best ? best.confidence : 0.25,
    };
  }

  /** Extractive, not generative — we never put words in the customer's mouth. */
  private summarize(text: string): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= 110) return clean;
    const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
    let out = "";
    for (const s of sentences) {
      if ((out + s).length > 110) break;
      out += s;
    }
    return (out.trim() || clean.slice(0, 107)).replace(/\s+\S*$/, "") + "…";
  }

  async draftFollowUp(input: { customerName: string; businessName: string; quoteTitle: string; totalCents: number; attempt: number }): Promise<string> {
    const first = input.customerName.split(" ")[0];
    const amount = `$${Math.round(input.totalCents / 100).toLocaleString("en-US")}`;
    switch (input.attempt) {
      case 1:
        return `Hi ${first}, just checking in on the ${input.quoteTitle.toLowerCase()} quote we sent over (${amount}). Happy to answer any questions or get you on the schedule. — ${input.businessName}`;
      case 2:
        return `Hi ${first}, following up on your ${input.quoteTitle.toLowerCase()} estimate. We still have openings this month if you'd like to lock in a date. Any questions about the ${amount} quote, just reply here. — ${input.businessName}`;
      default:
        return `Hi ${first}, last note from us on the ${input.quoteTitle.toLowerCase()} quote — we don't want to crowd your inbox. The ${amount} estimate stays good for 30 days, so reach out whenever the timing works. — ${input.businessName}`;
    }
  }
}

let provider: IntelligenceProvider | null = null;
export function getIntelligence(): IntelligenceProvider {
  if (!provider) provider = new KeywordIntelligence();
  return provider;
}
