/**
 * Automation definitions. Deliberately free of `server-only` so scripts and
 * client components can read the shape without pulling in the runtime engine.
 */
import type { AutomationStep } from "@/db/schema";

export const AUTOMATION_KEYS = {
  newLead: "new_lead",
  quoteAccepted: "quote_accepted",
  quoteFollowUp: "quote_followup",
  jobComplete: "job_complete",
  reviewRequest: "review_request",
} as const;

export type AutomationKey = (typeof AUTOMATION_KEYS)[keyof typeof AUTOMATION_KEYS];

export const DEFAULT_AUTOMATIONS: Array<{ key: AutomationKey; name: string; description: string; steps: AutomationStep[] }> = [
  {
    key: "new_lead",
    name: "New lead received",
    description: "Acknowledge the customer instantly and put the lead in front of the owner.",
    steps: [
      { type: "notify_owner", template: "New {service} lead from {customer}." },
      { type: "message", channel: "sms", template: "Hi {first}, thanks for reaching out to {business}! We got your request and will follow up with a quote shortly." },
    ],
  },
  {
    key: "quote_accepted",
    name: "Quote accepted",
    description: "Turn an accepted quote into a schedulable job without anyone retyping it.",
    steps: [
      { type: "create_job" },
      { type: "offer_times" },
      { type: "notify_owner", template: "{customer} accepted a {amount} quote." },
    ],
  },
  {
    key: "quote_followup",
    name: "Quote follow-up sequence",
    description: "Three spaced nudges on an unanswered quote. Stops the moment the customer replies.",
    steps: [
      { type: "wait", days: 1 }, { type: "message", channel: "sms", template: "" },
      { type: "wait", days: 2 }, { type: "message", channel: "sms", template: "" },
      { type: "wait", days: 4 }, { type: "message", channel: "sms", template: "" },
    ],
  },
  {
    key: "job_complete",
    name: "Job completed",
    description: "Invoice on completion, then ask for a review once the work has settled.",
    steps: [
      { type: "send_invoice" },
      { type: "wait", days: 1 },
      { type: "request_review" },
    ],
  },
  {
    key: "review_request",
    name: "Review request",
    description: "Route happy customers to a public review, unhappy ones to private feedback.",
    steps: [{ type: "request_review" }],
  },
];
