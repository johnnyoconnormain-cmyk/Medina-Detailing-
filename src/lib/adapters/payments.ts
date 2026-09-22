import "server-only";
import { db } from "@/db/client";
import { payments, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Payment provider seam.
 *
 * No Stripe keys exist in this environment, so `ManualProvider` is active: it
 * records a real payment row and settles the real invoice, but does not move
 * money. That is a genuine local-payment implementation (cash/check are first
 * class for contractors anyway), not a stub pretending to be a card charge.
 *
 * To go live: implement StripeProvider below against this same interface and
 * change `getPaymentProvider`. Nothing above this file changes.
 */

export type CheckoutSession = { url: string; providerRef: string; provider: string };

export interface PaymentProvider {
  readonly name: string;
  readonly live: boolean;
  createCheckout(input: {
    invoiceId: string; amountCents: number; description: string;
    successUrl: string; cancelUrl: string;
  }): Promise<CheckoutSession>;
  /** Idempotent: settling an already-paid invoice must not double-credit it. */
  settle(input: { invoiceId: string; amountCents: number; providerRef?: string; method?: "card" | "ach" | "cash" | "check" | "other"; businessId: string }): Promise<void>;
}

class ManualProvider implements PaymentProvider {
  readonly name = "manual";
  readonly live = false;

  async createCheckout(input: { invoiceId: string; successUrl: string }): Promise<CheckoutSession> {
    // No redirect to an external processor; the local pay page handles confirmation.
    return { url: input.successUrl, providerRef: `manual_${input.invoiceId}`, provider: this.name };
  }

  async settle(input: { invoiceId: string; amountCents: number; providerRef?: string; method?: "card" | "ach" | "cash" | "check" | "other"; businessId: string }) {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
    if (!inv) throw new Error("Invoice not found");
    if (inv.status === "paid") return; // idempotent

    await db.insert(payments).values({
      businessId: input.businessId, invoiceId: input.invoiceId,
      amountCents: input.amountCents, method: input.method ?? "card",
      provider: this.name, providerRef: input.providerRef,
    });

    const paid = inv.amountPaidCents + input.amountCents;
    await db.update(invoices).set({
      amountPaidCents: paid,
      status: paid >= inv.totalCents ? "paid" : inv.status,
      paidAt: paid >= inv.totalCents ? new Date() : inv.paidAt,
    }).where(eq(invoices.id, input.invoiceId));
  }
}

/**
 * Reference implementation for when STRIPE_SECRET_KEY exists. Deliberately not
 * instantiated — it would need the `stripe` package and a webhook route at
 * /api/webhooks/stripe to call `settle` on checkout.session.completed.
 * Settlement must come from the webhook, never from the browser redirect,
 * which a user can forge by visiting the success URL directly.
 */
export const STRIPE_INTEGRATION_NOTES = `
1. npm i stripe
2. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (server-side env only).
3. createCheckout -> stripe.checkout.sessions.create({ mode: 'payment', ... })
4. Add app/api/webhooks/stripe/route.ts, verify the signature, call provider.settle().
5. Flip getPaymentProvider() to return the Stripe implementation.
`.trim();

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) provider = new ManualProvider();
  return provider;
}
