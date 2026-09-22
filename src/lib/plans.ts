/** Plan definitions. Single source of truth for the marketing page and, later, billing. */

export type Plan = {
  id: "starter" | "pro" | "scale";
  name: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 149,
    tagline: "For an owner-operator who's tired of the notebook.",
    features: [
      "Lead inbox with intake link",
      "Quote builder and customer quote pages",
      "Scheduling calendar",
      "Customer database",
      "Up to 2 users",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 299,
    tagline: "For a crew of 3–15 that wants the follow-ups handled.",
    highlight: true,
    features: [
      "Everything in Starter",
      "Automated follow-up sequences",
      "Invoicing and online payments",
      "Before/after photo documentation",
      "Crew assignment and mobile field view",
      "Business analytics",
      "Up to 15 users",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthly: 499,
    tagline: "For multi-crew operations running several trucks a day.",
    features: [
      "Everything in Pro",
      "Multiple crews with routing",
      "Advanced automation branching",
      "Custom reporting and exports",
      "Priority support",
      "Unlimited users",
    ],
  },
];

export const BILLING_ENABLED = false;
