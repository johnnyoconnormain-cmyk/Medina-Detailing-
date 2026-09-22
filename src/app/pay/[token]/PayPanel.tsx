"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { payInvoiceFormAction } from "@/actions/invoices";
import { fmtMoney } from "@/lib/money";

function PayButton({ dueCents }: { dueCents: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 text-base">
      {pending ? "Processing…" : `Pay ${fmtMoney(dueCents)}`}
    </button>
  );
}

export function PayPanel({ token, alreadyPaid, dueCents, businessName, providerLive, reviewToken }: {
  token: string; alreadyPaid: boolean; dueCents: number;
  businessName: string; providerLive: boolean; reviewToken: string | null;
}) {
  if (alreadyPaid) {
    return (
      <div className="card mt-4 border-moss-300 bg-moss-50 p-5 text-center dark:border-moss-800 dark:bg-moss-950">
        <p className="text-base font-semibold text-moss-800 dark:text-moss-200">Payment received</p>
        <p className="mt-1.5 text-sm text-moss-700 dark:text-moss-300">
          Thank you! {businessName} has been notified.
        </p>
        {reviewToken && (
          <Link href={`/review/${reviewToken}`} className="btn btn-primary mt-3 text-xs">
            Tell them how they did
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <form action={payInvoiceFormAction}>
        <input type="hidden" name="token" value={token} />
        <PayButton dueCents={dueCents} />
      </form>

      {!providerLive && (
        <p className="mt-3 rounded border border-clay-200 bg-clay-50 px-3 py-2.5 text-2xs leading-relaxed text-clay-900 dark:border-clay-900 dark:bg-clay-950 dark:text-clay-200">
          <strong>No card processor is connected.</strong> This records the invoice as
          paid in the business&apos;s books, the way a cash or cheque payment would — it does
          not move money. Connect Stripe to take cards here.
        </p>
      )}

      <p className="mt-3 text-center text-2xs text-faint">
        Questions about this invoice? Contact {businessName} directly.
      </p>
    </div>
  );
}
