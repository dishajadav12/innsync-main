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

BUDGET:
- Strongly prefer properties within budget.

REVIEWS:
- Analyze review sentiment deeply.
- Infer hidden qualities from reviews.

BOOKING POPULARITY:
- Frequently booked stays are more trustworthy.

GUEST CAPACITY:
- Must fit requested guest count.

QUALITY:
- Highly rated stays should rank higher.

VIBE MATCHING:
Examples:
- "peaceful"
- "luxury"
- "romantic"
- "workcation"
- "nature"
- "family trip"

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
    })
  ),
});

type RecommendationResponse = z.infer<typeof recommendationSchema>;

const positiveHints = [
  "clean",
  "quiet",
  "peaceful",
  "luxury",
  "comfortable",
  "friendly",
  "helpful",
  "work",
  "wifi",
  "romantic",
  "family",
];

const negativeHints = [
  "noisy",
  "dirty",
  "slow",
  "bad",
  "poor",
  "uncomfortable",
  "broken",
  "expensive",
  "crowded",
];

const clampScore = (score: number) => Math.max(0, Math.min(98, Math.round(score)));

const normalizeScore = (rawScore: number) => {
  // Logistic compression keeps ordering but avoids many items collapsing at the score cap.
  const bounded = (100 / (1 + Math.exp(-(rawScore - 70) / 20))) * 0.98;
  return clampScore(bounded);
};

const includesSome = (source: string, targets: string[]) => {
  const lower = source.toLowerCase();
  return targets.some((target) => lower.includes(target.toLowerCase()));
};

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
) => {
  let score = 20;
  const reasons: string[] = [];

  const preferredCategories = preferences.preferredCategories ?? [];
  const preferredCountries = (preferences.country ?? []).map((item) => item.toLowerCase());
  const preferredCities = (preferences.city ?? []).map((item) => item.toLowerCase());
  const requestedAmenities = (preferences.amenities ?? []).map((item) => item.toLowerCase());
  const requestedGuests = preferences.guests ?? 1;
  const budgetMin = preferences.budget?.min;
  const budgetMax = preferences.budget?.max;
  const locationText = [property.country, property.city].filter(Boolean).join(" ").toLowerCase();

  if (preferredCountries.length > 0) {
    if (preferredCountries.includes(property.country.toLowerCase())) {
      score += 30;
      reasons.push("Country match");
    } else {
      score -= 25;
      reasons.push("Different country than selected");
    }
  }

  if (preferredCities.length > 0) {
    const selectedCity = (property.city ?? "").toLowerCase();
    if (selectedCity && preferredCities.includes(selectedCity)) {
      score += 25;
      reasons.push("City match");
    } else {
      score -= 15;
      reasons.push("Different city than selected");
    }
  }

  if (preferredCategories.length > 0) {
    if (preferredCategories.includes(property.category)) {
      score += 28;
      reasons.push("Exact category match");
    }
  }

  if (property.guests >= requestedGuests) {
    score += 15;
    reasons.push("Fits guest capacity");
  } else {
    score -= 50;
    reasons.push("Insufficient guest capacity");
  }

  if (requestedAmenities.length > 0) {
    const matched = requestedAmenities.filter((amenity) =>
      property.amenities.some((existing) => existing.includes(amenity))
    );
    const missing = requestedAmenities.filter((amenity) => !matched.includes(amenity));
    score += matched.length * 8;
    score -= missing.length * 10;
    if (matched.length > 0) {
      reasons.push(`Matched ${matched.length} requested amenities`);
    }
    if (missing.length > 0) {
      reasons.push(`Missing ${missing.length} requested amenities`);
    }
  }

  if (typeof budgetMin === "number" && property.price < budgetMin) {
    score -= 10;
    reasons.push("Below your target budget range");
  }
  if (typeof budgetMax === "number") {
    if (property.price <= budgetMax) {
      score += 20;
      reasons.push("Within budget");
    } else {
      const delta = property.price - budgetMax;
      score -= Math.min(50, Math.ceil(delta / 10));
      reasons.push("Above budget");
    }
  }

  score += Math.min(18, property.averageRating * 3.5);
  score += Math.min(12, Math.floor(property.bookingCount / 2));

  const reviewText = property.reviews.join(" ").toLowerCase();
  const vibeText = [property.category, property.description, reviewText, locationText].join(" ").toLowerCase();
  const vibePreferences = (preferences.vibe ?? []).map((item) => item.toLowerCase());
  if (vibePreferences.length > 0) {
    const matchedVibes = vibePreferences.filter((vibe) => vibeText.includes(vibe));
    score += matchedVibes.length * 6;
    if (matchedVibes.length > 0) {
      reasons.push(`Vibe alignment on ${matchedVibes.length} preferences`);
    }
  }

  const tripTypePreferences = (preferences.tripType ?? []).map((item) => item.toLowerCase());
  if (tripTypePreferences.length > 0) {
    const matchedTripType = tripTypePreferences.filter((tripType) => vibeText.includes(tripType));
    score += matchedTripType.length * 4;
  }

  if (preferences.workFriendly && includesSome(reviewText, ["work", "workspace", "wifi", "desk"])) {
    score += 8;
    reasons.push("Review sentiment suggests work-friendly stay");
  } else if (preferences.workFriendly) {
    score -= 10;
    reasons.push("Weak work-friendly signals in reviews");
  }

  if (includesSome(reviewText, positiveHints)) {
    score += 6;
  }
  if (includesSome(reviewText, negativeHints)) {
    score -= 8;
  }

  return {
    score: normalizeScore(score),
    reasons,
  };
};

export const buildPrompt = (
  preferences: UserPreferences,
  propertiesData: ModelPropertyPayload[]
) => {
  return recommendationPrompt
    .replace("{{USER_PREFERENCES}}", JSON.stringify(preferences, null, 2))
    .replace("{{PROPERTIES_DATA}}", JSON.stringify(propertiesData, null, 2));
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
      const matched = requestedAmenities.filter((amenity) =>
        property.amenities.some((existing) => existing.includes(amenity))
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
