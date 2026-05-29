import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import db from "@/utils/db";
import {
  buildFallbackResponse,
  buildPrompt,
  clampScore,
  computeBackendScore,
  diversifyByBudgetTier,
  extractJsonObject,
  persistRecommendationSession,
  toModelPayload,
  type UserPreferences,
  validateRecommendationResponse,
} from "@/utils/recommendation";

const DEFAULT_FETCH_SIZE    = 100;
const DEFAULT_SHORTLIST_SIZE = 15;
const DEFAULT_RESULT_SIZE   = 20;

// ── In-memory rate limiter ────────────────────────────────────────────────────
// 10 requests per minute per IP. Works for single-instance deployments;
// for multi-instance (e.g. Vercel with many regions) a Redis store is better.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX        = 10;
const RATE_LIMIT_WINDOW_MS  = 60 * 1000;

const checkRateLimit = (ip: string): boolean => {
  const now   = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
};

const evictStaleRateLimitEntries = () => {
  const now = Date.now();
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
};

// Blended sort constants: match quality is primary, recency is a small boost for
// new listings that haven't yet accumulated bookings/reviews.
// At RECENCY_WEIGHT=0.12 a brand-new 40% match scores 35+14=49 vs a 6-month-old
// 95% match at 83. The old listing wins — only truly competitive new listings surface.
const RECENCY_WEIGHT    = 0.12;
const RECENCY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 90-day freshness window

const isCitySchemaMismatch = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("unknown arg `city`") ||
    message.includes("unknown argument `city`") ||
    (message.includes("column") && message.includes("city"))
  );
};

const safeJson = async (req: NextRequest) => {
  try {
    return await req.json();
  } catch {
    return null;
  }
};

const hasAmenityOverlap = (requestedAmenities: string[], propertyAmenities: string[]) => {
  if (requestedAmenities.length === 0) return false;
  return requestedAmenities.some((requested) =>
    propertyAmenities.some((existing) => existing.includes(requested))
  );
};

// Preference-aware category diversification.
// Without preferences: ensures variety (one property per category first pass, then fill).
// With preferences: preferred categories take 65% of slots; others diversified into 35%.
const diversifyByCategory = <T extends { property: { category: string } }>(
  items: T[],
  limit: number,
  preferredCategories: string[] = []
): T[] => {
  if (preferredCategories.length === 0) {
    // No preference: spread results across as many categories as possible
    const selected: T[] = [];
    const remaining = [...items];
    const usedCategories = new Set<string>();

    for (let i = 0; i < remaining.length && selected.length < limit; i += 1) {
      const current = remaining[i];
      if (usedCategories.has(current.property.category)) continue;
      selected.push(current);
      usedCategories.add(current.property.category);
      remaining.splice(i, 1);
      i -= 1;
    }
    for (const current of remaining) {
      if (selected.length >= limit) break;
      selected.push(current);
    }
    return selected;
  }

  // Preference-aware: user asked for specific categories → give them most of the slots
  const preferredCap = Math.ceil(limit * 0.65);
  const otherCap     = limit - preferredCap;

  const preferredItems = items.filter((i) => preferredCategories.includes(i.property.category));
  const otherItems     = items.filter((i) => !preferredCategories.includes(i.property.category));

  // Diversify the non-preferred slice (one per non-preferred category first)
  const diverseOthers: T[]         = [];
  const usedOtherCategories         = new Set<string>();
  for (const item of otherItems) {
    if (diverseOthers.length >= otherCap) break;
    if (usedOtherCategories.has(item.property.category)) continue;
    diverseOthers.push(item);
    usedOtherCategories.add(item.property.category);
  }
  for (const item of otherItems) {
    if (diverseOthers.length >= otherCap) break;
    if (!diverseOthers.includes(item)) diverseOthers.push(item);
  }

  return [...preferredItems.slice(0, preferredCap), ...diverseOthers].slice(0, limit);
};

const computeTierLabel = (
  price: number,
  min: number | undefined,
  max: number | undefined
): string => {
  if (min == null || max == null || min >= max) return "";
  const range = max - min;
  const tierCount = range < 400 ? 2 : range <= 1200 ? 3 : 4;
  const step = range / tierCount;
  for (let i = tierCount - 1; i >= 0; i--) {
    const floor = min + i * step;
    if (price >= floor) {
      return `$${Math.round(floor)}–$${Math.round(i === tierCount - 1 ? max : floor + step)}/night`;
    }
  }
  return `$${min}–$${Math.round(min + step)}/night`;
};

export const POST = async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json({ message: "Too many requests. Please wait a minute." }, { status: 429 });
  }
  // Evict stale entries once the store grows large (keeps memory bounded).
  if (rateLimitStore.size > 5000) evictStaleRateLimitEntries();

  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = auth();

  const preferences  = (body.preferences ?? {}) as UserPreferences;
  const fetchSize    = Math.min(Math.max(Number(body.fetchSize    ?? DEFAULT_FETCH_SIZE),    20), 200);
  const shortlistSize = Math.min(Math.max(Number(body.shortlistSize ?? DEFAULT_SHORTLIST_SIZE), 5),  25);
  const resultSize   = Math.min(Math.max(Number(body.resultSize   ?? DEFAULT_RESULT_SIZE),    5),  30);

  const preferredCountries    = preferences.country ?? [];
  const preferredCities       = preferences.city    ?? [];
  const hasLocationPreference = preferredCountries.length > 0 || preferredCities.length > 0;

  const locationWhereClause = {
    ...(preferredCountries.length > 0 ? { country: { in: preferredCountries } } : {}),
    ...(preferredCities.length     > 0 ? { city:    { in: preferredCities    } } : {}),
  };
  const strictWhereClause = {
    ...locationWhereClause,
    ...(typeof preferences.guests === "number"
      ? { guests: { gte: preferences.guests } }
      : {}),
    ...(typeof preferences.budget?.min === "number" || typeof preferences.budget?.max === "number"
      ? {
          price: {
            ...(typeof preferences.budget?.min === "number" ? { gte: preferences.budget.min } : {}),
            ...(typeof preferences.budget?.max === "number" ? { lte: preferences.budget.max } : {}),
          },
        }
      : {}),
  };

  const queryOptions = {
    take: fetchSize,
    orderBy: { updatedAt: "desc" as const },
    include: {
      reviews: {
        select: { rating: true, comment: true },
      },
      bookings: {
        where:  { paymentStatus: true },
        select: { id: true },
      },
    },
  };

  const runCandidatesQuery = async (queryWhere: Prisma.PropertyWhereInput) => {
    try {
      return await db.property.findMany({
        where: { ...queryWhere, isOnHold: false },
        ...queryOptions,
      });
    } catch (error) {
      if (!isCitySchemaMismatch(error)) throw error;
      const { city, ...fallbackWhereClause } = queryWhere;
      return db.property.findMany({
        where: { ...fallbackWhereClause, isOnHold: false },
        ...queryOptions,
      });
    }
  };

  let candidates = await runCandidatesQuery(strictWhereClause);

  if (candidates.length === 0 && hasLocationPreference) {
    candidates = await runCandidatesQuery(locationWhereClause);
  }

  const candidatePool =
    candidates.length >= Math.max(shortlistSize, 10) || hasLocationPreference
      ? candidates
      : await db.property.findMany({
          where: { isOnHold: false },
          ...queryOptions,
        });

  const scoredAll = candidatePool
    .map((property) => {
      const payload = toModelPayload({
        id:           property.id,
        name:         property.name,
        image:        property.image,
        category:     property.category,
        city:         property.city,
        country:      property.country,
        description:  property.description,
        price:        property.price,
        guests:       property.guests,
        amenitiesRaw: property.amenities,
        reviews:      property.reviews,
        bookingCount: property.bookings.length,
      });
      const { score, reasons } = computeBackendScore(preferences, payload);
      return { property: payload, score, reasons, createdAtMs: property.createdAt.getTime() };
    })
    .sort((a, b) => b.score - a.score);

  const requestedAmenities = (preferences.amenities ?? []).map((item) => item.toLowerCase());
  let rankedScored = scoredAll;

  if (hasLocationPreference && requestedAmenities.length > 0) {
    const withAmenityMatch    = scoredAll.filter((item) =>
      hasAmenityOverlap(requestedAmenities, item.property.amenities)
    );
    const withoutAmenityMatch = scoredAll.filter((item) =>
      !hasAmenityOverlap(requestedAmenities, item.property.amenities)
    );
    rankedScored = [...withAmenityMatch, ...withoutAmenityMatch];
  }

  const categoryDiversified = diversifyByCategory(
    rankedScored,
    Math.max(shortlistSize, resultSize),
    preferences.preferredCategories ?? []
  );

  const scored = diversifyByBudgetTier(
    categoryDiversified,
    preferences,
    3
  );

  const createdAtById = new Map(
    scored.map(({ property, createdAtMs }) => [property.id, createdAtMs] as const)
  );

  // Blended sort: matchScore drives ranking; recency gives a small lift to new listings
  // so they're not buried by established properties with high cached scores.
  // This replaces the old pure-chronological sort where newest always won regardless of fit.
  const sortByRelevance = <T extends { propertyId: string; matchScore: number }>(
    items: T[]
  ): T[] => {
    const now = Date.now();
    return [...items].sort((a, b) => {
      const aCreated   = createdAtById.get(a.propertyId) ?? 0;
      const bCreated   = createdAtById.get(b.propertyId) ?? 0;
      const aFreshness = Math.max(0, 1 - (now - aCreated) / RECENCY_WINDOW_MS);
      const bFreshness = Math.max(0, 1 - (now - bCreated) / RECENCY_WINDOW_MS);
      const aBlended   = a.matchScore * (1 - RECENCY_WEIGHT) + aFreshness * 98 * RECENCY_WEIGHT;
      const bBlended   = b.matchScore * (1 - RECENCY_WEIGHT) + bFreshness * 98 * RECENCY_WEIGHT;
      return bBlended - aBlended;
    });
  };

  if (scored.length === 0) {
    return Response.json(
      {
        summary: {
          topMatchReason: "Currently no properties for your preference",
          totalAnalyzed: 0,
        },
        recommendations: [],
      },
      { status: 200 }
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    const fallback = buildFallbackResponse(preferences, scored);
    const sorted1WithTiers = sortByRelevance(fallback.recommendations)
      .slice(0, resultSize)
      .map((r) => ({
        ...r,
        tierLabel: computeTierLabel(
          scored.find((s) => s.property.id === r.propertyId)?.property.price ?? 0,
          preferences.budget?.min,
          preferences.budget?.max
        ),
      }));
    try {
      await persistRecommendationSession({
        profileId:      userId ?? null,
        preferences,
        topMatchReason: fallback.summary.topMatchReason,
        totalAnalyzed:  fallback.summary.totalAnalyzed,
        modelUsed:      "fallback",
        results: sorted1WithTiers.map((r, idx) => ({
          propertyId:    r.propertyId,
          propertyName:  r.propertyName,
          rank:          idx + 1,
          matchScore:    r.matchScore,
          matchReasons:  r.matchReasons  ?? [],
          strengths:     r.strengths     ?? [],
          concerns:      r.concerns      ?? [],
          reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
          budgetFit:     r.budgetFit     ?? { withinBudget: true, priceAssessment: "" },
          amenityMatch:  r.amenityMatch  ?? { matched: [], missing: [] },
          aiSummary:     r.aiSummary     ?? "",
        })),
      });
    } catch (err) {
      console.error("[RecommendationSession] persist failed:", err);
    }
    return Response.json({ ...fallback, recommendations: sorted1WithTiers }, { status: 200 });
  }

  try {
    // Shuffle the shortlist before sending to Gemini to eliminate position bias.
    // LLMs rate earlier items more favourably; randomising the order means Gemini's
    // qualitative analysis is independent of the backend ranking.
    const shuffled       = [...scored].sort(() => Math.random() - 0.5);
    const backendScoreById = new Map(
      scored.map(({ property, score }) => [property.id, score] as const)
    );

    const prompt = buildPrompt(
      preferences,
      shuffled.map((item) => item.property),
      backendScoreById
    );

    const genAI  = new GoogleGenerativeAI(geminiApiKey);
    const model  = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const text   = result.response.text();

    const jsonText  = extractJsonObject(text);
    const parsed    = JSON.parse(jsonText);
    const validated = validateRecommendationResponse(parsed);

    const propertyById = new Map(scored.map(({ property }) => [property.id, property] as const));

    // Blend backend score (objective rule-based) with Gemini's ordering (qualitative).
    // 78% backend prevents Gemini from arbitrarily overriding hard constraints.
    // 22% Gemini rank signal rewards properties Gemini identified as strong qualitative fits.
    const enrichedRecommendations = validated.recommendations.map((item, geminiRank) => {
      const backendScore  = backendScoreById.get(item.propertyId) ?? item.matchScore;
      const geminiSignal  = Math.max(0, 98 - geminiRank * 4); // rank 0→98, rank 24→2
      const blendedScore  = clampScore(backendScore * 0.78 + geminiSignal * 0.22);
      return {
        ...item,
        matchScore:    blendedScore,
        propertyImage: propertyById.get(item.propertyId)?.image ?? item.propertyImage ?? "",
        city:          propertyById.get(item.propertyId)?.city  ?? item.city,
        state:         propertyById.get(item.propertyId)?.country ?? item.state,
        tierLabel:     computeTierLabel(
                         propertyById.get(item.propertyId)?.price ?? 0,
                         preferences.budget?.min,
                         preferences.budget?.max
                       ),
      };
    });

    const sorted2 = sortByRelevance(enrichedRecommendations).slice(0, resultSize);
    try {
      await persistRecommendationSession({
        profileId:      userId ?? null,
        preferences,
        topMatchReason: validated.summary.topMatchReason,
        totalAnalyzed:  validated.summary.totalAnalyzed,
        modelUsed:      "gemini-1.5-pro",
        results: sorted2.map((r, idx) => ({
          propertyId:    r.propertyId,
          propertyName:  r.propertyName,
          rank:          idx + 1,
          matchScore:    r.matchScore,
          matchReasons:  r.matchReasons  ?? [],
          strengths:     r.strengths     ?? [],
          concerns:      r.concerns      ?? [],
          reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
          budgetFit:     r.budgetFit     ?? { withinBudget: true, priceAssessment: "" },
          amenityMatch:  r.amenityMatch  ?? { matched: [], missing: [] },
          aiSummary:     r.aiSummary     ?? "",
        })),
      });
    } catch (err) {
      console.error("[RecommendationSession] persist failed:", err);
    }
    return Response.json({ ...validated, recommendations: sorted2 }, { status: 200 });
  } catch {
    const fallback2 = buildFallbackResponse(preferences, scored);
    const sorted3WithTiers = sortByRelevance(fallback2.recommendations)
      .slice(0, resultSize)
      .map((r) => ({
        ...r,
        tierLabel: computeTierLabel(
          scored.find((s) => s.property.id === r.propertyId)?.property.price ?? 0,
          preferences.budget?.min,
          preferences.budget?.max
        ),
      }));
    try {
      await persistRecommendationSession({
        profileId:      userId ?? null,
        preferences,
        topMatchReason: fallback2.summary.topMatchReason,
        totalAnalyzed:  fallback2.summary.totalAnalyzed,
        modelUsed:      "fallback",
        results: sorted3WithTiers.map((r, idx) => ({
          propertyId:    r.propertyId,
          propertyName:  r.propertyName,
          rank:          idx + 1,
          matchScore:    r.matchScore,
          matchReasons:  r.matchReasons  ?? [],
          strengths:     r.strengths     ?? [],
          concerns:      r.concerns      ?? [],
          reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
          budgetFit:     r.budgetFit     ?? { withinBudget: true, priceAssessment: "" },
          amenityMatch:  r.amenityMatch  ?? { matched: [], missing: [] },
          aiSummary:     r.aiSummary     ?? "",
        })),
      });
    } catch (err) {
      console.error("[RecommendationSession] persist failed:", err);
    }
    return Response.json({ ...fallback2, recommendations: sorted3WithTiers }, { status: 200 });
  }
};
