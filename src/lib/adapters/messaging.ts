import "server-only";
import { db } from "@/db/client";
import { messages } from "@/db/schema";

/**
 * Outbound SMS/email seam.
 *
 * Nothing sends over a real carrier yet, so every outbound message is recorded
 * in the `messages` table and shows up in the customer's communication history
 * exactly as a real one would. The automation engine and UI are therefore fully
 * exercised; only the final hop to Twilio/Resend is missing.
 */
export type OutboundMessage = {
  businessId: string; customerId: string | null; jobId?: string | null; quoteId?: string | null;
  channel: "sms" | "email"; body: string; automated?: boolean;
};

export interface MessagingProvider {
  readonly name: string;
  readonly live: boolean;
  send(msg: OutboundMessage): Promise<{ recorded: true; delivered: boolean }>;
}

class RecordOnlyMessaging implements MessagingProvider {
  readonly name = "record-only";
  readonly live = false;

  async send(msg: OutboundMessage) {
    await db.insert(messages).values({
      businessId: msg.businessId, customerId: msg.customerId ?? null,
      jobId: msg.jobId ?? null, quoteId: msg.quoteId ?? null,
      direction: "outbound", channel: msg.channel, body: msg.body,
      automated: msg.automated ?? false,
    });
    // delivered:false is the honest answer — it was logged, not transmitted.
    return { recorded: true as const, delivered: false };
  }
}

let messaging: MessagingProvider | null = null;
export function getMessaging(): MessagingProvider {
  if (!messaging) messaging = new RecordOnlyMessaging();
  return messaging;
}
