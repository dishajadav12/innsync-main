import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prisma } from "@prisma/client";
import db from "@/utils/db";
import {
  buildFallbackResponse,
  buildPrompt,
  computeBackendScore,
  extractJsonObject,
  persistRecommendationSession,
  toModelPayload,
  type UserPreferences,
  validateRecommendationResponse,
} from "@/utils/recommendation";

const DEFAULT_FETCH_SIZE = 100;
const DEFAULT_SHORTLIST_SIZE = 15;
const DEFAULT_RESULT_SIZE = 20;

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

const diversifyByCategory = <T extends { property: { category: string } }>(
  items: T[],
  limit: number
) => {
  const selected: T[] = [];
  const remaining = [...items];
  const usedCategories = new Set<string>();

  // First pass: pick the highest scored item from as many different categories as possible.
  for (let i = 0; i < remaining.length && selected.length < limit; i += 1) {
    const current = remaining[i];
    if (usedCategories.has(current.property.category)) continue;
    selected.push(current);
    usedCategories.add(current.property.category);
    remaining.splice(i, 1);
    i -= 1;
  }

  // Second pass: fill remaining slots by score order.
  for (const current of remaining) {
    if (selected.length >= limit) break;
    selected.push(current);
  }

  return selected;
};

export const POST = async (req: NextRequest) => {
  const body = await safeJson(req);
  if (!body || typeof body !== "object") {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = auth();

  const preferences = (body.preferences ?? {}) as UserPreferences;
  const fetchSize = Math.min(Math.max(Number(body.fetchSize ?? DEFAULT_FETCH_SIZE), 20), 200);
  const shortlistSize = Math.min(
    Math.max(Number(body.shortlistSize ?? DEFAULT_SHORTLIST_SIZE), 5),
    25
  );
  const resultSize = Math.min(
    Math.max(Number(body.resultSize ?? DEFAULT_RESULT_SIZE), 5),
    30
  );

  const preferredCountries = preferences.country ?? [];
  const preferredCities = preferences.city ?? [];
  const hasLocationPreference = preferredCountries.length > 0 || preferredCities.length > 0;
  const locationWhereClause = {
    ...(preferredCountries.length > 0 ? { country: { in: preferredCountries } } : {}),
    ...(preferredCities.length > 0 ? { city: { in: preferredCities } } : {}),
  };
  const strictWhereClause = {
    ...locationWhereClause,
    ...(typeof preferences.guests === "number" ? { guests: { gte: preferences.guests } } : {}),
    ...(typeof preferences.budget?.min === "number" || typeof preferences.budget?.max === "number"
      ? {
          price: {
            ...(typeof preferences.budget?.min === "number"
              ? { gte: preferences.budget.min }
              : {}),
            ...(typeof preferences.budget?.max === "number"
              ? { lte: preferences.budget.max }
              : {}),
          },
        }
      : {}),
  };

  const queryOptions = {
    take: fetchSize,
    orderBy: { updatedAt: "desc" as const },
    include: {
      reviews: {
        select: {
          rating: true,
          comment: true,
        },
      },
      bookings: {
        where: {
          paymentStatus: true,
        },
        select: {
          id: true,
        },
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
      if (!isCitySchemaMismatch(error)) {
        throw error;
      }

      const { city, ...fallbackWhereClause } = queryWhere;

      return db.property.findMany({
        where: { ...fallbackWhereClause, isOnHold: false },
        ...queryOptions,
      });
    }
  };

  let candidates = await runCandidatesQuery(strictWhereClause);

  // Keep location strict when selected, but let scoring decide category relevance.
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
        id: property.id,
        name: property.name,
        image: property.image,
        category: property.category,
        city: property.city,
        country: property.country,
        description: property.description,
        price: property.price,
        guests: property.guests,
        amenitiesRaw: property.amenities,
        reviews: property.reviews,
        bookingCount: property.bookings.length,
      });
      const score = computeBackendScore(preferences, payload);
      return {
        property: payload,
        score: score.score,
        reasons: score.reasons,
        createdAtMs: property.createdAt.getTime(),
      };
    })
    .sort((a, b) => b.score - a.score);

  const requestedAmenities = (preferences.amenities ?? []).map((item) => item.toLowerCase());
  let rankedScored = scoredAll;

  if (hasLocationPreference && requestedAmenities.length > 0) {
    const withAmenityMatch = scoredAll.filter((item) =>
      hasAmenityOverlap(requestedAmenities, item.property.amenities)
    );
    const withoutAmenityMatch = scoredAll.filter(
      (item) => !hasAmenityOverlap(requestedAmenities, item.property.amenities)
    );
    rankedScored = [...withAmenityMatch, ...withoutAmenityMatch];
  }

  const scored = diversifyByCategory(
    rankedScored,
    Math.max(shortlistSize, resultSize)
  );

  const createdAtById = new Map(
    scored.map(({ property, createdAtMs }) => [property.id, createdAtMs] as const)
  );

  const sortChronological = <T extends { propertyId: string; matchScore: number }>(items: T[]) =>
    [...items].sort((a, b) => {
      const aCreatedAt = createdAtById.get(a.propertyId) ?? 0;
      const bCreatedAt = createdAtById.get(b.propertyId) ?? 0;
      if (aCreatedAt !== bCreatedAt) {
        return bCreatedAt - aCreatedAt;
      }
      return b.matchScore - a.matchScore;
    });

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
    const sorted1 = sortChronological(fallback.recommendations).slice(0, resultSize);
    persistRecommendationSession({
      profileId: userId ?? null,
      preferences,
      topMatchReason: fallback.summary.topMatchReason,
      totalAnalyzed: fallback.summary.totalAnalyzed,
      modelUsed: "fallback",
      results: sorted1.map((r, idx) => ({
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        rank: idx + 1,
        matchScore: r.matchScore,
        matchReasons: r.matchReasons ?? [],
        strengths: r.strengths ?? [],
        concerns: r.concerns ?? [],
        reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
        budgetFit: r.budgetFit ?? { withinBudget: true, priceAssessment: "" },
        amenityMatch: r.amenityMatch ?? { matched: [], missing: [] },
        aiSummary: r.aiSummary ?? "",
      })),
    }).catch((err) => console.error("[RecommendationSession] persist failed:", err));
    return Response.json({ ...fallback, recommendations: sorted1 }, { status: 200 });
  }

  try {
    const prompt = buildPrompt(
      preferences,
      scored.map((item) => item.property)
    );

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonText = extractJsonObject(text);
    const parsed = JSON.parse(jsonText);
    const validated = validateRecommendationResponse(parsed);
    const propertyById = new Map(scored.map(({ property }) => [property.id, property] as const));
    const backendScoreById = new Map(scored.map(({ property, score }) => [property.id, score] as const));
    const enrichedRecommendations = validated.recommendations.map((item) => ({
      ...item,
      matchScore: backendScoreById.get(item.propertyId) ?? item.matchScore,
      propertyImage:
        propertyById.get(item.propertyId)?.image ?? item.propertyImage ?? "",
      city: propertyById.get(item.propertyId)?.city ?? item.city,
      state: propertyById.get(item.propertyId)?.country ?? item.state,
    }));

    const sorted2 = sortChronological(enrichedRecommendations).slice(0, resultSize);
    persistRecommendationSession({
      profileId: userId ?? null,
      preferences,
      topMatchReason: validated.summary.topMatchReason,
      totalAnalyzed: validated.summary.totalAnalyzed,
      modelUsed: "gemini-1.5-pro",
      results: sorted2.map((r, idx) => ({
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        rank: idx + 1,
        matchScore: r.matchScore,
        matchReasons: r.matchReasons ?? [],
        strengths: r.strengths ?? [],
        concerns: r.concerns ?? [],
        reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
        budgetFit: r.budgetFit ?? { withinBudget: true, priceAssessment: "" },
        amenityMatch: r.amenityMatch ?? { matched: [], missing: [] },
        aiSummary: r.aiSummary ?? "",
      })),
    }).catch((err) => console.error("[RecommendationSession] persist failed:", err));
    return Response.json({ ...validated, recommendations: sorted2 }, { status: 200 });
  } catch {
    const fallback2 = buildFallbackResponse(preferences, scored);
    const sorted3 = sortChronological(fallback2.recommendations).slice(0, resultSize);
    persistRecommendationSession({
      profileId: userId ?? null,
      preferences,
      topMatchReason: fallback2.summary.topMatchReason,
      totalAnalyzed: fallback2.summary.totalAnalyzed,
      modelUsed: "fallback",
      results: sorted3.map((r, idx) => ({
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        rank: idx + 1,
        matchScore: r.matchScore,
        matchReasons: r.matchReasons ?? [],
        strengths: r.strengths ?? [],
        concerns: r.concerns ?? [],
        reviewInsights: r.reviewInsights ?? { commonPositiveThemes: [], commonNegativeThemes: [] },
        budgetFit: r.budgetFit ?? { withinBudget: true, priceAssessment: "" },
        amenityMatch: r.amenityMatch ?? { matched: [], missing: [] },
        aiSummary: r.aiSummary ?? "",
      })),
    }).catch((err) => console.error("[RecommendationSession] persist failed:", err));
    return Response.json({ ...fallback2, recommendations: sorted3 }, { status: 200 });
  }
};
