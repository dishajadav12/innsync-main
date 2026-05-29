import { z } from "zod";
import db from "@/utils/db";

export type UserPreferences = {
  country?: string[];
  city?: string[];
  tripType?: string[];
  preferredCategories?: string[];
  amenities?: string[];
  budget?: {
    min?: number;
    max?: number;
  };
  guests?: number;
  workFriendly?: boolean;
  vibe?: string[];
};

export type PropertyForRecommendation = {
  id: string;
  name: string;
  image: string;
  category: string;
  city?: string | null;
  country: string;
  description: string;
  price: number;
  guests: number;
  amenitiesRaw: string;
  reviews: Array<{ rating: number; comment: string }>;
  bookingCount: number;
};

export type ModelPropertyPayload = {
  id: string;
  name: string;
  image: string;
  category: string;
  city?: string | null;
  country: string;
  description: string;
  price: number;
  guests: number;
  amenities: string[];
  averageRating: number;
  bookingCount: number;
  reviews: string[];
};

export const recommendationPrompt = `SYSTEM ROLE:
You are an advanced AI travel recommendation engine for a stay-booking platform similar to Airbnb.

Your task is to analyze:
1. User preferences
2. Property metadata
3. Reviews
4. Booking popularity
5. Amenities
6. Property vibe and suitability

Then intelligently rank the best matching stays.

You MUST behave like a professional recommendation engine.

--------------------------------------------------
IMPORTANT RULES
--------------------------------------------------

1. Return ONLY valid JSON.
2. Do NOT return markdown.
3. Do NOT explain outside JSON.
4. Do NOT hallucinate missing data.
5. Match score must be between 0-100.
6. Recommendations must be sorted highest match first.
7. Use reviews heavily to infer hidden qualities:
   - remote work friendly
   - peaceful
   - romantic
   - noisy
   - family-friendly
   - luxury feel
   - cleanliness
   - hospitality
8. Penalize properties outside budget.
9. Penalize properties missing important requested amenities.
10. Favor highly rated and highly booked properties.
11. Explain WHY each recommendation fits the user.
12. Be realistic and specific.

--------------------------------------------------
USER PREFERENCES
--------------------------------------------------

{{USER_PREFERENCES}}

--------------------------------------------------
AVAILABLE PROPERTIES
--------------------------------------------------

{{PROPERTIES_DATA}}

--------------------------------------------------
SCORING LOGIC
--------------------------------------------------

Use these ranking priorities:

CATEGORY MATCH:
- Exact category/vibe match is extremely important.

AMENITIES:
- Match requested amenities carefully.
- wifi/internet and kitchen are critical — missing them is a strong negative.
- pool/gym/hot tub are nice-to-have — missing them is a minor negative.

BUDGET:
- Strongly prefer properties within budget.
- Compare price per guest, not absolute price.

REVIEWS:
- Analyze review sentiment deeply.
- Infer hidden qualities from reviews.

BOOKING POPULARITY:
- Frequently booked stays are more trustworthy.

GUEST CAPACITY:
- Must fit requested guest count.
- Near-exact fits are preferred over massive over-accommodation.

QUALITY:
- Highly rated stays should rank higher.
- Distrust ratings with very few reviews — a single 5-star review is less reliable than 50 reviews at 4.8.

VIBE MATCHING:
Examples:
- "peaceful"
- "luxury"
- "romantic"
- "workcation"
- "nature"
- "family trip"

BACKEND PRE-SCORE:
- Each property includes a \`backendScore\` (0–98) from a rule-based engine.
- Use it as a starting anchor for your ranking.
- Your analysis can adjust a property ±15 points based on review quality and vibe fit.
- Large deviations from backendScore require explicit justification in matchReasons.

--------------------------------------------------
RETURN FORMAT
--------------------------------------------------

{
  "summary": {
    "topMatchReason": "",
    "totalAnalyzed": 0
  },

  "recommendations": [
    {
      "propertyId": "",
      "propertyName": "",

      "matchScore": 0,

      "matchReasons": [
        ""
      ],

      "strengths": [
        ""
      ],

      "concerns": [
        ""
      ],

      "reviewInsights": {
        "commonPositiveThemes": [],
        "commonNegativeThemes": []
      },

      "budgetFit": {
        "withinBudget": true,
        "priceAssessment": ""
      },

      "amenityMatch": {
        "matched": [],
        "missing": []
      },

      "aiSummary": ""
    }
  ]
}`;

const recommendationSchema = z.object({
  summary: z.object({
    topMatchReason: z.string(),
    totalAnalyzed: z.number(),
  }),
  recommendations: z.array(
    z.object({
      propertyId: z.string(),
      propertyName: z.string(),
      propertyImage: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      matchScore: z.number().min(0).max(100),
      matchReasons: z.array(z.string()),
      strengths: z.array(z.string()),
      concerns: z.array(z.string()),
      reviewInsights: z.object({
        commonPositiveThemes: z.array(z.string()),
        commonNegativeThemes: z.array(z.string()),
      }),
      budgetFit: z.object({
        withinBudget: z.boolean(),
        priceAssessment: z.string(),
      }),
      amenityMatch: z.object({
        matched: z.array(z.string()),
        missing: z.array(z.string()),
      }),
      aiSummary: z.string(),
      tierLabel: z.string().optional(),
    })
  ),
});

type RecommendationResponse = z.infer<typeof recommendationSchema>;

// ────────────────────────────────────────────────────────────────────────────
// SCORE_WEIGHTS — all scoring constants in one place.
// Change weights here; never put magic numbers in the scoring logic below.
// ────────────────────────────────────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  // Location: user-declared hard preferences
  COUNTRY_MATCH:           30,
  COUNTRY_MISS:           -25,
  CITY_MATCH:              25,
  CITY_MISS:              -15,

  // Category: soft preference (no penalty for mismatch — a great property still shows)
  CATEGORY_MATCH:          28,

  // Capacity: under-capacity effectively disqualifies (-50 pushes below noise floor)
  GUESTS_FITS:             15,
  GUESTS_UNDER_CAPACITY:  -50,
  GUESTS_EXACT_FIT_BONUS:   5,  // property.guests within [requested, requested+2]

  // Amenities: tiered by traveler impact
  AMENITY_CRITICAL_MATCH:  12,
  AMENITY_CRITICAL_MISS:  -15,
  AMENITY_IMPORTANT_MATCH:  8,
  AMENITY_IMPORTANT_MISS:  -8,
  AMENITY_NICETOHAVE_MATCH: 4,
  AMENITY_NICETOHAVE_MISS: -2,

  // Budget: compared price-per-guest so group properties are not penalized
  BUDGET_WITHIN_MAX:       25,
  BUDGET_BELOW_MIN:        -16,
  BUDGET_OVER_PER_10:      -1,   // -1 per $10 over budget (per guest)
  BUDGET_OVER_CAP:        -40,

  // Quality: Bayesian rating prevents single-review gaming; booking signals demand
  RATING_MAX:              18,
  RATING_SCALE:           3.5,
  BAYESIAN_M:              25,   // confidence floor — lower if median review count < 10
  BAYESIAN_C:             4.0,   // global mean prior — update from real DB data if available
  BOOKING_MAX:             12,
  BOOKING_DIVISOR:          2,

  // Vibe / trip type: synonym-expanded, capped to prevent synonym stacking
  VIBE_PER_MATCH:           6,
  VIBE_CAP_MULTIPLIER:      2,   // max matched synonyms = original prefs × this
  TRIP_TYPE_PER_MATCH:      4,
  TRIP_TYPE_CAP_MULTIPLIER: 2,

  // Work-friendly: binary intent signal
  WORK_MATCH:               8,
  WORK_MISS:               -8,

  // Sentiment: frequency-weighted with negation detection, capped both ways
  SENTIMENT_MAX:           10,
  SENTIMENT_MIN:          -10,

  // Completeness: small trust signal for well-described listings
  COMPLETENESS_MAX:         4,

  // Normalizer: inflection at 100 so a solid location+budget+guests match → ~49%
  // (old value was 70 which caused all good results to cluster at 89–98)
  NORM_INFLECTION:        100,
  NORM_SCALE:              30,
} as const;

// ── Amenity synonym table ────────────────────────────────────────────────────
// Keys are canonical terms. Values are all valid strings in property amenities.
// To add a new amenity type: add key+synonyms here, add tier below, done.
const AMENITY_SYNONYMS: Record<string, string[]> = {
  wifi:               ["wifi", "wi-fi", "wireless", "internet", "broadband", "high-speed internet"],
  "air conditioning": ["air conditioning", "ac", "a/c", "aircon", "climate control", "central air"],
  heating:            ["heating", "central heating", "radiator", "heated floor"],
  kitchen:            ["kitchen", "kitchenette", "full kitchen", "cooking facilities"],
  washer:             ["washer", "washing machine", "laundry in unit"],
  dryer:              ["dryer", "clothes dryer"],
  parking:            ["parking", "free parking", "private parking", "car park", "garage"],
  pool:               ["pool", "swimming pool", "outdoor pool", "indoor pool"],
  gym:                ["gym", "fitness center", "workout room", "exercise equipment"],
  "hot tub":          ["hot tub", "jacuzzi", "whirlpool", "spa bath"],
  workspace:          ["workspace", "desk", "work desk", "dedicated workspace"],
  tv:                 ["tv", "television", "smart tv", "cable tv", "streaming"],
  "pet friendly":     ["pet friendly", "pets allowed", "dogs allowed", "cats allowed", "pets welcome"],
};

type AmenityTier = "critical" | "important" | "nicetohave";

// Tier controls both match reward and miss penalty (see SCORE_WEIGHTS above).
const AMENITY_TIERS: Record<string, AmenityTier> = {
  wifi:               "critical",    // deal-breaker for most travelers
  internet:           "critical",
  kitchen:            "critical",    // affects trip budget and daily experience
  "air conditioning": "important",
  heating:            "important",
  parking:            "important",
  washer:             "important",   // matters for stays > 3 nights
  workspace:          "important",   // remote workers need this
  "pet friendly":     "important",   // travelers with pets cannot compromise
  pool:               "nicetohave",
  gym:                "nicetohave",
  "hot tub":          "nicetohave",
  fireplace:          "nicetohave",
  tv:                 "nicetohave",
};

// ── Vibe synonym expansion ───────────────────────────────────────────────────
// Maps user vibe terms to related words found in descriptions and reviews.
// Fixes false negatives: "peaceful" matches "tranquil", "serene", "calm", etc.
const VIBE_SYNONYMS: Record<string, string[]> = {
  romantic:  ["romantic", "couples", "intimate", "date", "honeymoon"],
  peaceful:  ["peaceful", "tranquil", "serene", "calm", "quiet", "relaxing"],
  luxury:    ["luxury", "luxurious", "upscale", "premium", "elegant", "exclusive"],
  family:    ["family", "kids", "children", "toddler", "family-friendly"],
  adventure: ["adventure", "hiking", "outdoor", "trail", "explore"],
  nature:    ["nature", "forest", "mountain", "lake", "ocean", "scenic"],
  urban:     ["urban", "city", "downtown", "metro", "central", "walkable"],
};

// Expanded keyword lists for frequency-weighted sentiment scoring
const POSITIVE_KEYWORDS = [
  "clean", "quiet", "peaceful", "luxury", "comfortable", "friendly",
  "helpful", "beautiful", "excellent", "amazing", "perfect", "spacious",
  "cozy", "modern", "convenient", "responsive", "immaculate",
];

const NEGATIVE_KEYWORDS = [
  "noisy", "dirty", "slow", "poor", "uncomfortable", "broken", "crowded",
  "musty", "stained", "outdated", "rude", "unresponsive", "misleading",
  "smells", "mold",
];

// Used by negation detection: window of 4 words before a keyword
const NEGATION_WORDS = new Set([
  "not", "wasn't", "isn't", "aren't", "weren't", "never", "no",
  "without", "lacking", "hardly", "barely", "doesn't", "didn't", "don't",
]);

export const clampScore = (score: number) => Math.max(0, Math.min(98, Math.round(score)));

// Inflection shifted from 70 → 100. Old inflection caused all good results to
// cluster at 89–98 (poor resolution). At 100, a solid location+budget+guests
// match lands at ~49%, spreading the relevant range across 50–90.
const normalizeScore = (rawScore: number): number => {
  const bounded =
    (100 / (1 + Math.exp(-(rawScore - SCORE_WEIGHTS.NORM_INFLECTION) / SCORE_WEIGHTS.NORM_SCALE))) *
    0.98;
  return clampScore(bounded);
};

// Word-boundary-aware keyword scan with negation detection.
// Counts exact word matches; negated occurrences subtract 2× from the total.
// This replaces the binary includesSome() which triggered on any substring match.
function scoreKeywordFrequency(text: string, keywords: string[]): number {
  const words = text
    .toLowerCase()
    .split(/[\s,.:;!?()\[\]"']+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  let total = 0;

  for (const keyword of keywords) {
    const kParts = keyword.toLowerCase().split(/\s+/);
    for (let i = 0; i <= words.length - kParts.length; i++) {
      if (!kParts.every((part, j) => words[i + j] === part)) continue;
      const context = words.slice(Math.max(0, i - 4), i);
      // "not clean" reverses the signal; counts -2 so 3 positives + 1 negated = +1
      total += context.some((w) => NEGATION_WORDS.has(w)) ? -2 : 1;
    }
  }
  return total;
}

// Resolves a user-typed amenity term to all known synonym strings.
// "ac" → ["air conditioning", "ac", "a/c", ...] so "ac" matches DB entry "air conditioning".
function resolveAmenitySynonyms(requested: string): string[] {
  const lower = requested.toLowerCase().trim();
  if (AMENITY_SYNONYMS[lower]) return AMENITY_SYNONYMS[lower];
  for (const synonyms of Object.values(AMENITY_SYNONYMS)) {
    if (synonyms.includes(lower)) return synonyms;
  }
  return [lower];
}

function getAmenityTier(requested: string): AmenityTier {
  const lower = requested.toLowerCase().trim();
  for (const [key, tier] of Object.entries(AMENITY_TIERS)) {
    if (key === lower || lower.includes(key) || key.includes(lower)) return tier;
  }
  return "nicetohave";
}

function amenityMatches(requested: string, propertyAmenities: string[]): boolean {
  const synonyms = resolveAmenitySynonyms(requested);
  return synonyms.some((syn) =>
    propertyAmenities.some((ex) => ex.includes(syn) || syn.includes(ex))
  );
}

// Bayesian average: shrinks unreliable low-review ratings toward the platform mean.
// 1 review at 5★ → 4.04 (pulled toward prior). 500 reviews at 4.8★ → 4.76 (trusted).
function bayesianRating(avgRating: number, reviewCount: number): number {
  const { BAYESIAN_M, BAYESIAN_C } = SCORE_WEIGHTS;
  return (reviewCount * avgRating + BAYESIAN_M * BAYESIAN_C) / (reviewCount + BAYESIAN_M);
}

// Expands vibe/tripType terms to synonyms then deduplicates.
function expandTerms(terms: string[], dict: Record<string, string[]>): string[] {
  const expanded = terms.flatMap((t) => dict[t.toLowerCase()] ?? [t.toLowerCase()]);
  return Array.from(new Set(expanded));
}

export const parseAmenities = (raw: string): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
        return parsed
          .filter((item) => Boolean(item.selected))
          .map((item) => String(item.name).toLowerCase().trim())
          .filter(Boolean);
      }
      return parsed.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
    }
  } catch {
    // fall through to CSV parsing
  }
  return raw
    .split(",")
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean);
};

export const toModelPayload = (
  property: PropertyForRecommendation
): ModelPropertyPayload => {
  const totalRating = property.reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = property.reviews.length
    ? Number((totalRating / property.reviews.length).toFixed(1))
    : 0;
  return {
    id: property.id,
    name: property.name,
    image: property.image,
    category: property.category,
    city: property.city,
    country: property.country,
    description: property.description,
    price: property.price,
    guests: property.guests,
    amenities: parseAmenities(property.amenitiesRaw),
    averageRating,
    bookingCount: property.bookingCount,
    reviews: property.reviews.map((review) => review.comment).filter(Boolean),
  };
};

export const computeBackendScore = (
  preferences: UserPreferences,
  property: ModelPropertyPayload
): { score: number; reasons: string[] } => {
  let score = 0; // base 0 — every point is earned, nothing is given for free
  const reasons: string[] = [];

  const preferredCountries  = (preferences.country ?? []).map((c) => c.toLowerCase());
  const preferredCities     = (preferences.city ?? []).map((c) => c.toLowerCase());
  const preferredCategories = preferences.preferredCategories ?? [];
  const requestedAmenities  = (preferences.amenities ?? []).map((a) => a.toLowerCase());
  const requestedGuests     = preferences.guests ?? 1;
  const budgetMin           = preferences.budget?.min;
  const budgetMax           = preferences.budget?.max;
  const reviewCount         = property.reviews.length;

  // ── Location ──────────────────────────────────────────────────────────────
  if (preferredCountries.length > 0) {
    if (preferredCountries.includes(property.country.toLowerCase())) {
      score += SCORE_WEIGHTS.COUNTRY_MATCH;
      reasons.push("Country match");
    } else {
      score += SCORE_WEIGHTS.COUNTRY_MISS;
      reasons.push("Different country");
    }
  }

  if (preferredCities.length > 0) {
    const propCity = (property.city ?? "").toLowerCase();
    if (propCity && preferredCities.includes(propCity)) {
      score += SCORE_WEIGHTS.CITY_MATCH;
      reasons.push("City match");
    } else {
      score += SCORE_WEIGHTS.CITY_MISS;
      reasons.push("Different city");
    }
  }

  // ── Category ──────────────────────────────────────────────────────────────
  if (preferredCategories.length > 0 && preferredCategories.includes(property.category)) {
    score += SCORE_WEIGHTS.CATEGORY_MATCH;
    reasons.push("Exact category match");
  }

  // ── Guest capacity ─────────────────────────────────────────────────────────
  if (property.guests >= requestedGuests) {
    score += SCORE_WEIGHTS.GUESTS_FITS;
    reasons.push("Fits guest count");
    // Near-exact fit bonus: a 12-person lodge for 2 guests is a poor experience match
    const overshoot = property.guests - requestedGuests;
    if (overshoot <= 2) {
      score += SCORE_WEIGHTS.GUESTS_EXACT_FIT_BONUS;
      reasons.push("Near-perfect capacity fit");
    }
  } else {
    score += SCORE_WEIGHTS.GUESTS_UNDER_CAPACITY;
    reasons.push("Insufficient guest capacity");
  }

  // ── Amenities: tiered importance + synonym-aware matching ─────────────────
  if (requestedAmenities.length > 0) {
    let matchCount = 0;
    let missCount = 0;

    for (const requested of requestedAmenities) {
      const tier = getAmenityTier(requested);
      if (amenityMatches(requested, property.amenities)) {
        matchCount++;
        score +=
          tier === "critical"
            ? SCORE_WEIGHTS.AMENITY_CRITICAL_MATCH
            : tier === "important"
              ? SCORE_WEIGHTS.AMENITY_IMPORTANT_MATCH
              : SCORE_WEIGHTS.AMENITY_NICETOHAVE_MATCH;
      } else {
        missCount++;
        score +=
          tier === "critical"
            ? SCORE_WEIGHTS.AMENITY_CRITICAL_MISS
            : tier === "important"
              ? SCORE_WEIGHTS.AMENITY_IMPORTANT_MISS
              : SCORE_WEIGHTS.AMENITY_NICETOHAVE_MISS;
      }
    }

    if (matchCount > 0) reasons.push(`Matched ${matchCount} requested amenities`);
    if (missCount > 0) reasons.push(`Missing ${missCount} requested amenities`);
  }

  // ── Budget: normalized per-guest so group properties aren't penalized ──────
  // $400 for 8 guests ($50/guest) should not lose to $100 for 1 guest ($100/guest).
  const effectiveGuests   = Math.max(requestedGuests, 1);
  const pricePerGuest     = property.price / Math.max(property.guests, effectiveGuests);
  const budgetMaxPerGuest = budgetMax != null ? budgetMax / effectiveGuests : undefined;
  const budgetMinPerGuest = budgetMin != null ? budgetMin / effectiveGuests : undefined;

  if (budgetMinPerGuest != null && pricePerGuest < budgetMinPerGuest) {
    score += SCORE_WEIGHTS.BUDGET_BELOW_MIN;
    reasons.push("Below your target budget range");
  }
  if (budgetMaxPerGuest != null) {
    if (pricePerGuest <= budgetMaxPerGuest) {
      score += SCORE_WEIGHTS.BUDGET_WITHIN_MAX;
      reasons.push("Within budget");
    } else {
      const delta = pricePerGuest - budgetMaxPerGuest;
      score += Math.max(
        SCORE_WEIGHTS.BUDGET_OVER_CAP,
        Math.ceil(delta / 10) * SCORE_WEIGHTS.BUDGET_OVER_PER_10
      );
      reasons.push("Above budget");
    }
  }

  // ── Quality: Bayesian rating + booking momentum ────────────────────────────
  // Bayesian average: 1 review at 5★ contributes less than 50 reviews at 4.8★.
  const bRating = bayesianRating(property.averageRating, reviewCount);
  score += Math.min(SCORE_WEIGHTS.RATING_MAX, bRating * SCORE_WEIGHTS.RATING_SCALE);
  score += Math.min(
    SCORE_WEIGHTS.BOOKING_MAX,
    Math.floor(property.bookingCount / SCORE_WEIGHTS.BOOKING_DIVISOR)
  );

  // ── Vibe & trip type: synonym-expanded, capped against inflation ───────────
  const locationText = [property.country, property.city].filter(Boolean).join(" ").toLowerCase();
  const reviewText   = property.reviews.join(" ").toLowerCase();
  const vibeText     = [property.category, property.description, reviewText, locationText]
    .join(" ")
    .toLowerCase();

  const expandedVibes = expandTerms(preferences.vibe ?? [], VIBE_SYNONYMS);
  const matchedVibes  = expandedVibes.filter((v) => vibeText.includes(v));
  if (matchedVibes.length > 0) {
    // Cap: each original preference term can match at most VIBE_CAP_MULTIPLIER synonyms
    const cap = (preferences.vibe ?? []).length * SCORE_WEIGHTS.VIBE_CAP_MULTIPLIER;
    score += Math.min(matchedVibes.length, cap) * SCORE_WEIGHTS.VIBE_PER_MATCH;
    reasons.push(`Vibe match: ${matchedVibes.slice(0, 3).join(", ")}`);
  }

  const expandedTrip = expandTerms(preferences.tripType ?? [], VIBE_SYNONYMS);
  const matchedTrip  = expandedTrip.filter((t) => vibeText.includes(t));
  if (matchedTrip.length > 0) {
    const cap = (preferences.tripType ?? []).length * SCORE_WEIGHTS.TRIP_TYPE_CAP_MULTIPLIER;
    score += Math.min(matchedTrip.length, cap) * SCORE_WEIGHTS.TRIP_TYPE_PER_MATCH;
    reasons.push("Trip type alignment");
  }

  // ── Work-friendly ──────────────────────────────────────────────────────────
  if (preferences.workFriendly) {
    const workSignal = scoreKeywordFrequency(reviewText, [
      "work", "workspace", "wifi", "desk", "laptop", "remote", "business",
    ]);
    if (workSignal > 0) {
      score += SCORE_WEIGHTS.WORK_MATCH;
      reasons.push("Work-friendly signals in reviews");
    } else {
      score += SCORE_WEIGHTS.WORK_MISS;
      reasons.push("Weak work-friendly signals");
    }
  }

  // ── Sentiment: frequency-weighted, negation-aware ─────────────────────────
  // "not clean" now subtracts; frequency matters (10 "clean" > 1 "clean").
  const posFreq = scoreKeywordFrequency(reviewText, POSITIVE_KEYWORDS);
  const negFreq = scoreKeywordFrequency(reviewText, NEGATIVE_KEYWORDS);
  score += Math.max(
    SCORE_WEIGHTS.SENTIMENT_MIN,
    Math.min(SCORE_WEIGHTS.SENTIMENT_MAX, posFreq - negFreq)
  );

  // ── Listing completeness ───────────────────────────────────────────────────
  let completeness = 0;
  if (property.description.length > 200) completeness += 2;
  if (property.amenities.length >= 5)    completeness += 1;
  if (reviewCount >= 3)                  completeness += 1;
  score += Math.min(SCORE_WEIGHTS.COMPLETENESS_MAX, completeness);

  return { score: normalizeScore(score), reasons };
};

// Hard limits on per-property text sent to Gemini.
// Without these, a property with 200 reviews + a 2000-char description blows
// the context window and increases token cost ~10× for no quality gain.
const PROMPT_DESC_MAX   = 350;
const PROMPT_REVIEWS_MAX = 5;

export const buildPrompt = (
  preferences: UserPreferences,
  propertiesData: ModelPropertyPayload[],
  backendScores?: Map<string, number>
): string => {
  // Trim each property before serialising: cap description length and review count.
  const data = propertiesData.map((p) => {
    const trimmed: ModelPropertyPayload & { backendScore?: number } = {
      ...p,
      description: p.description.length > PROMPT_DESC_MAX
        ? p.description.slice(0, PROMPT_DESC_MAX) + "…"
        : p.description,
      reviews: p.reviews.slice(0, PROMPT_REVIEWS_MAX),
    };
    if (backendScores) trimmed.backendScore = backendScores.get(p.id) ?? 0;
    return trimmed;
  });
  return recommendationPrompt
    .replace("{{USER_PREFERENCES}}", JSON.stringify(preferences, null, 2))
    .replace("{{PROPERTIES_DATA}}", JSON.stringify(data, null, 2));
};

export const extractJsonObject = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(start, end + 1);
};

export const validateRecommendationResponse = (data: unknown): RecommendationResponse => {
  const parsed = recommendationSchema.parse(data);
  return {
    ...parsed,
    recommendations: parsed.recommendations
      .map((item) => ({ ...item, matchScore: clampScore(item.matchScore) }))
      .sort((a, b) => b.matchScore - a.matchScore),
  };
};

export const buildFallbackResponse = (
  preferences: UserPreferences,
  scored: Array<{ property: ModelPropertyPayload; score: number; reasons: string[] }>
) => {
  return {
    summary: {
      topMatchReason: scored[0]?.reasons[0] ?? "Best overall weighted score",
      totalAnalyzed: scored.length,
    },
    recommendations: scored.map(({ property, score, reasons }) => {
      const requestedAmenities = (preferences.amenities ?? []).map((item) => item.toLowerCase());
      // Use amenityMatches for synonym-aware matching (same logic as scoring)
      const matched = requestedAmenities.filter((amenity) =>
        amenityMatches(amenity, property.amenities)
      );
      const missing = requestedAmenities.filter((amenity) => !matched.includes(amenity));
      const withinBudget =
        typeof preferences.budget?.max !== "number" || property.price <= preferences.budget.max;
      return {
        propertyId: property.id,
        propertyName: property.name,
        propertyImage: property.image,
        city: property.city ?? undefined,
        state: property.country,
        matchScore: clampScore(score),
        matchReasons: reasons.length ? reasons : ["Strong overall fit"],
        strengths: [
          `Average rating ${property.averageRating}`,
          `${property.bookingCount} historical bookings`,
        ],
        concerns: missing.length ? [`Missing amenities: ${missing.join(", ")}`] : [],
        reviewInsights: {
          commonPositiveThemes: ["cleanliness", "comfort", "location"],
          commonNegativeThemes: [],
        },
        budgetFit: {
          withinBudget,
          priceAssessment: withinBudget
            ? `Within target budget at ${property.price}`
            : `Above budget at ${property.price}`,
        },
        amenityMatch: {
          matched,
          missing,
        },
        aiSummary:
          reasons[0] ?? "Recommended based on category fit, quality signals, and booking history.",
      };
    }),
  } satisfies RecommendationResponse;
};

export function splitIntoBudgetTiers<T extends { property: { price: number } }>(
  items: T[],
  minPrice: number,
  maxPrice: number,
  tierCount: number
): Map<string, T[]> {
  const tiers = new Map<string, T[]>();
  if (minPrice >= maxPrice || tierCount <= 1) {
    const label = `$${minPrice}+`;
    tiers.set(label, [...items]);
    return tiers;
  }

  const range = maxPrice - minPrice;
  const step = range / tierCount;

  // Build tier labels and empty buckets
  const tierLabels: string[] = [];
  for (let i = 0; i < tierCount; i++) {
    const floor = Math.round(minPrice + i * step);
    const label = `$${floor}+`;
    tierLabels.push(label);
    tiers.set(label, []);
  }

  for (const item of items) {
    const price = item.property.price;
    // Find which tier bucket this price falls in
    let assigned = false;
    for (let i = tierCount - 1; i >= 0; i--) {
      const floor = minPrice + i * step;
      if (price >= floor) {
        tiers.get(tierLabels[i])!.push(item);
        assigned = true;
        break;
      }
    }
    // Price below minPrice → assign to lowest tier
    if (!assigned) {
      tiers.get(tierLabels[0])!.push(item);
    }
  }

  return tiers;
}

export function diversifyByBudgetTier<T extends { property: { price: number }; score: number }>(
  items: T[],
  preferences: UserPreferences,
  slotsPerTier = 3
): T[] {
  const min = preferences.budget?.min;
  const max = preferences.budget?.max;

  // No budget preference or degenerate range → return unchanged
  if (min == null || max == null || min >= max) return items;

  const range = max - min;
  const tierCount = range < 400 ? 2 : range <= 1200 ? 3 : 4;

  const tierMap = splitIntoBudgetTiers(items, min, max, tierCount);

  const selected: T[] = [];
  const used = new Set<T>();

  // Pass 1: take up to slotsPerTier from each tier (best score first within tier)
  for (const [, bucket] of Array.from(tierMap)) {
    const sorted = [...bucket].sort((a, b) => b.score - a.score);
    let taken = 0;
    for (const item of sorted) {
      if (taken >= slotsPerTier) break;
      if (!used.has(item)) {
        selected.push(item);
        used.add(item);
        taken++;
      }
    }
  }

  // Pass 2: fill remaining slots from leftovers sorted by score
  const remaining = items.filter((i) => !used.has(i)).sort((a, b) => b.score - a.score);
  for (const item of remaining) {
    if (selected.length >= items.length) break;
    selected.push(item);
  }

  return selected;
}

export type SessionPersistInput = {
  profileId:      string | null;
  preferences:    UserPreferences;
  topMatchReason: string;
  totalAnalyzed:  number;
  modelUsed:      string;
  results: Array<{
    propertyId:     string;
    propertyName:   string;
    rank:           number;
    matchScore:     number;
    matchReasons:   string[];
    strengths:      string[];
    concerns:       string[];
    reviewInsights: { commonPositiveThemes: string[]; commonNegativeThemes: string[] };
    budgetFit:      { withinBudget: boolean; priceAssessment: string };
    amenityMatch:   { matched: string[]; missing: string[] };
    aiSummary:      string;
  }>;
};

export const persistRecommendationSession = async (
  input: SessionPersistInput
): Promise<void> => {
  await db.recommendationSession.create({
    data: {
      profileId:      input.profileId,
      preferences:    input.preferences as object,
      topMatchReason: input.topMatchReason,
      totalAnalyzed:  input.totalAnalyzed,
      modelUsed:      input.modelUsed,
      status:         "active",
      results: {
        create: input.results.map((r) => ({
          propertyId:     r.propertyId,
          propertyName:   r.propertyName,
          rank:           r.rank,
          matchScore:     r.matchScore,
          matchReasons:   r.matchReasons,
          strengths:      r.strengths,
          concerns:       r.concerns,
          reviewInsights: r.reviewInsights as object,
          budgetFit:      r.budgetFit as object,
          amenityMatch:   r.amenityMatch as object,
          aiSummary:      r.aiSummary,
        })),
      },
    },
  });
};
