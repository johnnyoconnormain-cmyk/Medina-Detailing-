"use client";

import { useState, useTransition } from "react";
import { submitReviewByToken } from "@/actions/invoices";

export function ReviewForm({ token, businessName, alreadyRated }: {
  token: string; businessName: string; alreadyRated: number | null;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState<null | { routedToPublic: boolean }>(
    alreadyRated ? { routedToPublic: alreadyRated >= 4 } : null,
  );
  const [pending, start] = useTransition();

  function submit(stars: number, text?: string) {
    start(async () => {
      const r = await submitReviewByToken(token, stars, text);
      if (r.ok) setSubmitted({ routedToPublic: Boolean(r.routedToPublic) });
      else setSubmitted({ routedToPublic: false });
    });
  }

  if (submitted) {
    // High ratings get INVITED to a public site; we never post on their behalf.
    return submitted.routedToPublic ? (
      <div className="card mt-8 p-6 text-center">
        <p className="text-base font-semibold">Thank you!</p>
        <p className="mt-1.5 text-sm text-muted">
          That means a lot to a small business. Would you share it publicly? It genuinely
          helps {businessName} reach more neighbours.
        </p>
        <a href="https://www.google.com/search?q=write+a+review" target="_blank" rel="noopener"
           className="btn btn-primary mt-4">Leave a public review</a>
        <p className="mt-2.5 text-2xs text-faint">
          Opens a new tab. You write it yourself — {businessName} can&apos;t post on your behalf.
        </p>
      </div>
    ) : (
      <div className="card mt-8 p-6 text-center">
        <p className="text-base font-semibold">Thank you for telling us</p>
        <p className="mt-1.5 text-sm text-muted">
          This went straight to {businessName} privately. Someone will follow up to make it right.
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <div className="mt-8">
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => { setRating(n); if (n >= 4) submit(n); }}
            disabled={pending} aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="p-1 transition-transform hover:scale-110">
            <svg width="38" height="38" viewBox="0 0 24 24"
                 fill={n <= shown ? "#e0a326" : "none"}
                 stroke={n <= shown ? "#e0a326" : "currentColor"}
                 strokeWidth="1.5" className={n <= shown ? "" : "text-bark-300 dark:text-bark-600"}>
              <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2l-5-4.9 6.9-1z" />
            </svg>
          </button>
        ))}
      </div>

      {rating > 0 && rating <= 3 && (
        <div className="card mt-6 p-4">
          <p className="text-sm font-medium">We&apos;re sorry we missed the mark.</p>
          <p className="mt-1 text-xs text-muted">
            Tell {businessName} what went wrong — this stays private and goes straight to the owner.
          </p>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4}
                    className="input mt-2.5 resize-y text-sm" placeholder="What happened?" />
          <button onClick={() => submit(rating, feedback)} disabled={pending}
                  className="btn btn-primary mt-2.5 w-full">
            {pending ? "Sending…" : "Send private feedback"}
          </button>
        </div>
      )}

      {rating === 0 && <p className="mt-4 text-center text-xs text-faint">Tap a star to rate</p>}
    </div>
  );
}
