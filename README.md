# InnSync

A full-stack short-stay booking platform with an AI-powered recommendation engine, ops tooling for managing listings and recommendation quality, and destination-based property collections.

---

## Features

### Guest
- **Browse & Search** — Filter properties by category (cabin, lodge, tent, cottage, etc.), search by name or tagline with 500ms debounce, view full property detail with map, amenities, host info, and reviews
- **AI Recommendations** — 8-step preference wizard (country → city → trip type → category → amenities → vibe → budget + guests) that produces scored, AI-explained stay suggestions powered by Google Gemini 1.5 Pro with a deterministic fallback
- **Destination Collections** — Save any property from a recommendation result into an auto-organised collection by country and city. First save creates the collection; subsequent saves from the same destination are added to the existing one
- **Bookings** — Date-range calendar with conflict detection, nightly price breakdown (base + cleaning fee + service fee + 10% tax), and booking confirmation
- **Favorites** — Heart-toggle any property to a personal saved list
- **Reviews** — Leave a star rating and written review per stay; one review per user per property

### Host
- **Rental Management** — Create, edit, and delete listings with full property details, category, amenities picker, and image URL
- **Hold Toggle** — Pause a listing's availability from the host dashboard; synced with admin hold
- **Reservations Dashboard** — View all bookings received on owned properties
- **Earnings Summary** — Total nights booked and revenue per listing

### Admin
- **Overview Dashboard** — Platform stats (users, properties, bookings, on-hold count, recommendation sessions) and monthly bookings bar chart
- **Listings Management** — View all properties across all hosts, create / edit / delete any listing, toggle hold status with automatic swap propagation to affected recommendations
- **Recommendation History** — Full audit log of every recommendation session: user, preferences as readable chips, top match, AI model used, swap events per slot, expandable result details

---

## Recommendation Engine

The engine runs in two sequential layers.

**Layer 1 — Deterministic backend scorer**  
Every candidate property is scored against user preferences across: location (country + city), property category, guest capacity, amenities (matched vs. missing), budget range, average rating, booking count, vibe keywords, trip type, work-friendliness, and review sentiment. Scores normalise to a 0–98 range via a logistic curve. Results are diversified by category before the shortlist is sent forward.

**Layer 2 — Gemini 1.5 Pro enrichment**  
The shortlisted properties are sent to Gemini with a structured prompt. Gemini produces natural-language explanations per property: match reasons, strengths, concerns, review insights, and an AI summary. Gemini's numeric scores are discarded in favour of the deterministic backend scores for consistency. If Gemini is unavailable, a structured fallback is built from backend data alone.

**Hold-triggered swap**  
When a property is put on hold, every stored `RecommendationResult` and `CollectionItem` that references it is surgically updated with the next-best scoring replacement. Sessions stay `active`. A swap audit trail (`replacedPropertyId`, `replacedPropertyName`, `replacedAt`, `replacedReason`) is written to each affected row.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon / Vercel Postgres) |
| ORM | Prisma |
| Auth | Clerk |
| AI | Google Gemini 1.5 Pro |
| Validation | Zod |
| Global State | Zustand |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Maps | React Leaflet |
| Charts | Recharts |
| Payments | Stripe (integrated, disabled for demo — bookings auto-confirm) |

---

## Database Schema

```
Profile ──< Property ──< Favorite >── Profile
   │              │
   └──< Review    └──< Booking
   └──< Booking
   └──< RecommendationSession ──< RecommendationResult
   └──< Collection ──< CollectionItem
```

Key decisions: `RecommendationResult.propertyId` has no FK to `Property` so history survives deletion. `propertyName` and `propertyImage` on result and collection rows are snapshots at save time. `Collection` enforces `@@unique([profileId, country, city])` so there is exactly one collection per user per destination.

---

## Environment Variables

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ADMIN_USER_ID=
GEMINI_API_KEY=
```

Stripe variables (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) are present in the codebase but unused while payments are disabled.

---

## Getting Started

```bash
npm install
npx prisma migrate dev
npx prisma db seed   # optional: seeds 550+ properties across 11 countries
npm run dev
```

---

## Questions, Assumptions, and Tradeoffs

The specification was deliberately open-ended. Below are the key product decisions made, the reasoning behind each, and the honest tradeoffs involved.

---

### Q1 — Who should see recommendation history, and how long should it be kept?

**Decision:** Admin-only. Retained for 90 days, then pruned.

Users have no access to past recommendation sessions. Instead, they can save individual properties from any recommendation result into destination-based collections — a more actionable, user-friendly primitive than a raw session log. Recommendation history is an internal ops and engineering tool, not a user-facing feature.

History is available to admins for operational analysis, but not stored forever. A cleanup action removes recommendation sessions older than 90 days (with `RecommendationResult` rows removed via cascade), keeping storage bounded while still preserving recent diagnostic value.

**Tradeoffs:**

| Tradeoff | Impact |
|---|---|
| Long-range trend analysis is limited | Because history is pruned after 90 days, year-over-year recommendation pattern analysis is not possible unless sessions are archived to a warehouse before cleanup |
| Anonymous sessions are lower quality | Unauthenticated users generate sessions with `profileId: null`. These cannot be tied to a person, making per-user preference analysis impossible for them |
| Users cannot re-run a past search | If a user ran a great search last week, they must redo the 8-step wizard to get it back. Collections partially solve this for saved properties, but not for the full preference set |
| GDPR / account deletion gap | Deleting a Clerk account sets `profileId` to `null` via `onDelete: SetNull`, but the session rows remain. A proper deletion flow would also purge or anonymise all associated session and result data |

**Questions I'd raise in a real team:**
- Should 90-day retention be enough for ops and product analytics, or should we add an archive pipeline before pruning?
- Should users eventually have a "recent searches" shortcut, or is collections-only sufficient?
- Does account deletion need to fully erase recommendation history, or is anonymisation (nullify profileId) sufficient for compliance?

---

### Q2 — Should hold be admin-only or synced with host actions?

**Decision:** Both host and admin can toggle hold. They write to the same `isOnHold` field on `Property`. The same swap propagation runs regardless of who triggered it.

Making hold admin-only creates a support bottleneck — hosts who need to pause a listing for renovation, personal use, or pricing changes must contact ops. Giving hosts direct control mirrors how real property platforms work and reduces friction.

**Tradeoffs:**

| Tradeoff | Impact |
|---|---|
| No audit trail of who held it or why | Currently the system cannot distinguish "admin hold for quality review" from "host pause for maintenance". A `HoldEvent` log table (actor, reason, timestamp) would close this gap |
| Host has no visibility into downstream effects | A popular listing going on hold can trigger swaps across many recommendation sessions. The host sees no indication of this. A warning on the toggle ("this will affect N users who have this saved") would improve transparency |
| No hold hierarchy | Admin holds and host holds have identical weight. If an admin holds a property for a policy violation, the host can currently unhold it. A precedence system (admin hold locks out host control) may be needed |
| Concurrent toggle race | If a host and admin toggle simultaneously, last write wins. Acceptable at current scale; needs optimistic locking or a queue at high volume |

**Questions I'd raise:**
- Should there be hold categories (admin review hold / host pause / maintenance) with different swap behaviours per type?
- Should admin holds be overrideable by hosts, or should admin takes precedence?
- Should a scheduled unhold be supported (e.g., "hold until 15 Jan")?

---

### Q3 — What should happen to existing recommendations when a property goes on hold?

**Decision:** Surgical swap at the slot level — no full session invalidation.

Two separate flows depending on where the property appeared:

**In user collections:** The `CollectionItem` row is updated in-place with the next-best replacement scored against the original preferences. `wasSwapped: true` and `originalPropertyName` are recorded. The user sees a fresh property the next time they view the collection — no notification, no broken state.

**In admin recommendation history:** The `RecommendationResult` row is updated with the replacement. Swap audit fields are written. The session stays `status: "active"`. The admin can see which slots were swapped, what replaced what, and when, without the session appearing broken or stale.

This is a deliberate choice against full session invalidation. Invalidating an entire session to remove one property is disproportionate — the other 19 results are still valid. Surgical replacement preserves session continuity for the ops team and silently keeps collections current for users.

**Tradeoffs:**

| Tradeoff | Impact |
|---|---|
| Replacement quality may be poor | The swap uses deterministic scoring only — no Gemini. If the held property was the only strong match and alternatives are weak, the replacement may have a noticeably lower score. There is currently no minimum score threshold: any available property will be used |
| No user notification | Users are not told their collection was updated. This is invisible by design (avoids noise) but may be confusing if a user remembers saving a specific property |
| Swap is synchronous | The swap runs inline inside the hold toggle action. For a high-traffic property held on a large platform, this could cause the toggle request to time out. This should be a background job at scale |
| Unhold does not restore originals | Taking a property off hold makes it eligible for new searches but does not undo previous swaps. Swapped collection items and recommendation slots retain their replacements |

**Questions I'd raise:**
- Should there be a minimum score threshold below which a swap is rejected and the slot is left empty rather than filled with a poor match?
- Should users be notified (in-app or email) when a saved collection item is replaced?
- If a property comes off hold, should the original be restored, or should swaps be permanent?

---

### Q4 — Should regeneration be proactive (immediate) or lazy (on next user visit)?

**Decision:** Proactive and synchronous. The swap fires the moment the hold toggle completes. By the time the admin sees the confirmation message, all affected recommendation slots and collection items have already been updated.

This directly addresses the product intent — "a way for the admin to swap in a replacement recommendation automatically." The admin action is the trigger; the swap is the automatic consequence.

**Tradeoffs:**

| Tradeoff | Impact |
|---|---|
| Synchronous = potential timeout | Swapping hundreds of sessions inside a single HTTP request will fail at scale. Production implementation needs a job queue (Inngest, Trigger.dev, BullMQ) with retries and per-session status tracking |
| No partial failure visibility | If the swap succeeds for 400 sessions but errors for 100, there is currently no per-session status. A job queue with per-job failure logging would surface this |
| Users with the page open see stale results | The swap updates stored data. A user who currently has the recommendations page open in their browser is looking at the old in-memory result and will not see the update until they re-run |
| No undo / dry-run | There is no "preview which sessions would be affected" before confirming a hold, and no automated rollback. A dry-run mode showing affected session count before toggle would reduce accidental impact |

**Questions I'd raise:**
- Is a synchronous toggle acceptable for the expected volume, or does ops need a "queued — swapping in background" response pattern?
- Should there be a dry-run: "show me how many sessions and collections would be affected before I confirm this hold"?
- Should bulk hold (e.g., hold all properties in a city) be supported?

---

### Additional Architecture Questions I'd Raise With The Team

**Scoring model versioning** — The deterministic scorer has no version number. When weights are adjusted, historical sessions in the DB were scored under different rules, making before/after comparisons unreliable. A `scorerVersion: String` field on `RecommendationSession` would enable clean algorithm A/B analysis.

**Cold start for new listings** — New properties with no reviews and no bookings score near-zero on quality signals and rarely surface in recommendations. A configurable "new listing boost" (e.g., +10 for properties created within the last 14 days) would help them get initial visibility before accumulating social proof.

**Search and recommendation disconnect** — The navbar search filters by name/tagline text. The recommendation engine uses preference signals. A user who types "quiet cabin near water" in the search bar gets no benefit from the AI. A natural-language intent parser bridging the two surfaces would significantly improve discoverability.

**Preference schema evolution** — Preferences are stored as `Json` on `RecommendationSession`. New preference fields added to `UserPreferences` in the future won't exist in old sessions. This is intentional (no migration needed) but querying and aggregating preferences for analytics needs to tolerate missing keys gracefully.

---

## What I'd Improve With More Time

### Recommendation quality

- **Bayesian average rating** — Weight ratings by review count, not just the mean. A property with 1 five-star review should not outrank one with 200 four-and-a-half-star reviews. Formula: `(n × r + m × C) / (n + m)` where `n` = review count, `r` = property average, `m` = confidence threshold, `C` = global platform average
- **Amenity synonym mapping** — `"AC"` → `"air conditioning"`, `"high-speed internet"` → `"wifi"`. Current substring match misses common aliases and alternative naming conventions
- **Per-review rating in sentiment** — Review comments are stored as plain strings with ratings discarded after averaging. Attaching the rating to each review comment would allow weighted sentiment scoring (a 5-star "peaceful and quiet" counts more than a 2-star "surprisingly had wifi")
- **Price-per-guest signal** — A $400/night property for 8 guests is cheaper per person than a $100/night property for 1. The scorer currently compares absolute price against the user's budget
- **Minimum swap score threshold** — Currently any available property is used as a replacement regardless of match quality. A configurable floor (e.g., reject swaps where the replacement scores below 25) would prevent poor replacements

### Admin tooling

- **Hold event audit log** — Record who toggled hold, when, and with what reason. Currently the system cannot distinguish a host pause from an admin quality review
- **Async swap job queue** — Move swap propagation from a synchronous server action to a background job (Inngest or similar). Toggle returns immediately; swap runs with retries and per-session status tracking
- **Preference analytics and overall dashboard** — Which cities, vibes, and categories are most requested; which combinations produce the lowest average match scores. Surfaces catalogue coverage gaps that the team can act on

### User experience

- **Saved search re-run** — A one-click button to re-run a previous preference set without stepping through the 8-step wizard again
- **Collection sharing** — Generate a shareable link to a destination collection for trip planning with travel partners
- **Match score breakdown** — Tapping a match score badge reveals which signals contributed: "Location +30, Category +28, Wifi matched +8, Above budget −15"
