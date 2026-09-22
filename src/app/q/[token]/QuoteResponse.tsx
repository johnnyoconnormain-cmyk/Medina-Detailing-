"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { acceptQuoteFormAction, declineQuoteFormAction } from "@/actions/quotes";

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full !py-3 text-base">
      {pending ? "Accepting…" : "Accept quote"}
    </button>
  );
}

function DeclineButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-ghost w-full border border-[rgb(var(--border))] text-xs">
      {pending ? "…" : "Not right now"}
    </button>
  );
}

export function QuoteResponse({ token, status, expired, businessName, businessPhone, hasJob }: {
  token: string; status: string; expired: boolean;
  businessName: string; businessPhone: string | null; hasJob: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (status === "accepted") {
    return (
      <div className="card mt-6 border-moss-300 bg-moss-50 p-5 text-center dark:border-moss-800 dark:bg-moss-950">
        <p className="text-base font-semibold text-moss-800 dark:text-moss-200">Quote accepted — thank you!</p>
        <p className="mt-1.5 text-sm text-moss-700 dark:text-moss-300">
          {businessName} has been notified and will reach out to confirm a time.
          {hasJob ? " Your job is on their schedule." : ""}
        </p>
        {businessPhone && (
          <a href={`tel:${businessPhone}`} className="btn btn-secondary mt-3 text-xs">Call {businessPhone}</a>
        )}
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="card mt-6 p-5 text-center">
        <p className="text-sm font-medium">This quote was declined.</p>
        <p className="mt-1 text-xs text-muted">
          Changed your mind? Give {businessName} a call and they&apos;ll send a fresh one.
        </p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="card mt-6 p-5 text-center">
        <p className="text-sm font-medium">This quote has expired.</p>
        <p className="mt-1 text-xs text-muted">Contact {businessName} for an updated price.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form action={acceptQuoteFormAction}>
        <input type="hidden" name="token" value={token} />
        <AcceptButton />
      </form>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAsking((a) => !a)} className="btn btn-secondary text-xs">
          Ask a question
        </button>
        <form action={declineQuoteFormAction}>
          <input type="hidden" name="token" value={token} />
          <DeclineButton />
        </form>
      </div>

      {asking && (
        <div className="card mt-2 p-4 text-center">
          <p className="text-xs text-muted">
            Call or text {businessName} directly — they&apos;ll pick up faster than email.
          </p>
          {businessPhone && (
            <div className="mt-2 flex justify-center gap-2">
              <a href={`tel:${businessPhone}`} className="btn btn-secondary text-xs">Call</a>
              <a href={`sms:${businessPhone}`} className="btn btn-secondary text-xs">Text</a>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-center text-2xs text-faint">
        Accepting lets {businessName} schedule the work. You won&apos;t be charged anything today.
      </p>
    </div>
  );
}
