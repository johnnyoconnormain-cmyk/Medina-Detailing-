# Par Value

Green fees for every public golf course within reach of Bellevue, in one place,
with an honest label on how much each price can be trusted.

No build step, no backend, no dependencies. It's an HTML file, a stylesheet,
a script, and a JSON file. It runs on GitHub Pages for free.

## Why this exists

If you want to play golf on the Eastside this weekend and you care what it
costs, you currently open about fifteen tabs. GolfNow shows you its own
inventory at its own prices. The aggregator sites that claim to list green fees
publish "estimated" numbers that are frequently wrong — while building this,
two directories disagreed about the same course by a factor of three ($24
versus $75). Meanwhile the course's own website often has a cheaper rate than
GolfNow, because courses would rather not pay the booking rake.

So the useful thing isn't a coupon feed. It's a straight answer to "what can I
play near me, when, and for how much" — with a link to the place that actually
takes your money.

## Running it

Any static server works. `fetch` is blocked on `file://`, so don't just
double-click the HTML:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To publish: enable GitHub Pages on this repo, serving from the branch root.

## The data model

Everything lives in [`data/courses.json`](data/courses.json). The important
idea is that **every price carries its provenance**. A rates site that hides
its uncertainty is worse than no rates site, so confidence is a first-class
field rather than a disclaimer buried in a footer.

```jsonc
{
  "id": "maplewood-renton",
  "name": "Maplewood Golf Course",
  "city": "Renton",
  "driveMinutes": 15,        // approximate, from downtown Bellevue
  "holes": 18,
  "par": 72,
  "type": "municipal",       // municipal | daily-fee | upscale-public | semi-private
  "walkable": true,
  "dynamicPricing": false,   // true = posted rate moves with demand
  "site": "https://…",
  "ratesUrl": "https://…",   // deep link to the course's own rate page
  "notes": "Shown on the card.",
  "rates": {
    "confidence": "reported", // verified | reported | unknown
    "checked": "2026-09-21",
    "estimate": null,         // used only when there are no bands
    "bands": [
      {
        "holes": 18,
        "days": [1, 2, 3, 4], // 0 = Sunday … 6 = Saturday
        "start": "05:00",
        "end": "23:59",
        "price": 52,
        "cart": false,
        "tag": "standard",    // standard | resident | senior | junior | twilight
        "label": "Mon–Thu 18"
      }
    ]
  },
  "sources": ["https://…"]
}
```

### Confidence levels

| Level | Means |
|---|---|
| `verified` | Read directly off the course's own rate page, on the date in `checked`. |
| `reported` | From a secondary source — city fee schedules, golf directories, search results. Close, but not first-hand. |
| `unknown` | No reliable price found. Any number shown is a rough range, rendered as `≈$30–50` and visually demoted. |

Only `standard` and `resident` bands set the headline price. Senior and junior
rates appear in the expandable table but don't undercut the number on the card,
because most people reading it don't qualify for them.

## Adding or fixing a course

1. Open the course's own rate page (not an aggregator).
2. Add or edit the entry in `data/courses.json`.
3. Set `confidence` to `verified` and `checked` to today's date.
4. Put the URL you read in `sources`.

The "How good is this data?" panel on the page lists exactly which courses are
still unconfirmed, so there's always a visible next task.

## Roadmap

**v1 — rates almanac (this).** Static, hand-maintained, honest about
confidence. Useful on its own.

**v2 — live availability.** Eastside courses run on a handful of booking
backends (foreUP, Lightspeed/Chronogolf, Teesnap). Map them one at a time and
show what's actually open, not just what it costs. This is a per-course grind,
which is precisely why it's defensible — and why staying regional beats going
national.

**v3 — alerts.** The real scarcity on the Eastside isn't price, it's a
weekend morning tee time. "Text me when a Saturday before 9am opens at any of
these six courses" is the feature people would pay for.

## Caveats

Drive times are approximate, measured loosely from downtown Bellevue.
Rates are peak season (roughly April–October); off-season is usually cheaper.
Several courses now use demand-based pricing, where no fixed rate card can be
fully correct — those are flagged on the card. Always confirm on the course's
own site before you drive.

---

This repository previously held a single-page site for Medina Detailing. That
version is preserved at the `detailing-site-v1` tag:

```bash
git checkout detailing-site-v1
```
