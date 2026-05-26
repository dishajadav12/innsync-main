"use server";

import {
  createReviewSchema,
  imageSchema,
  profileSchema,
  validateWithZodSchema,
} from "./schemas";
import db from "./db";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { propertySchema } from "./schemas";
import { Console } from "console";
import { calculateTotals } from "./calculateTotals";
import { formatDate } from "./format";
import { computeBackendScore, toModelPayload, type UserPreferences } from "@/utils/recommendation";

const getAuthUser = async () => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("You must be logged in to perform this action");
  }

  const profile = await db.profile.findUnique({
    where: { clerkId: userId },
    select: { clerkId: true },
  });
  if (!profile) redirect("/profile/create");
  return { id: userId };
};

const getAdminUser = async () => {
  const user = await getAuthUser();
  if (user.id !== process.env.ADMIN_USER_ID) redirect("/");
  return user;
};

const renderError = (error: unknown): { message: string } => {
  console.log(error);
  return {
    message: error instanceof Error ? error.message : "An error occurred",
  };
};

export const createProfileAction = async (
  prevState: any,
  formData: FormData
) => {
  try {
    const { userId } = auth();
    if (!userId) throw new Error("User not found");

    const existingProfile = await db.profile.findUnique({
      where: { clerkId: userId },
      select: { clerkId: true },
    });
    if (existingProfile) {
      redirect("/");
    }

    const user = await clerkClient.users.getUser(userId);

    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(profileSchema, rawData);
    await db.profile.create({
      data: {
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? `${user.id}@example.com`,
        profileImage: user.imageUrl ?? "",
        ...validatedFields,
      },
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "An error occurred",
    };
  }
  redirect("/"); // Redirect to home page
};

export const fetchProfileImage = async () => {
  try {
    const { userId } = auth();
    if (!userId) return null;

    const profile = await db.profile.findUnique({
      where: { clerkId: userId },
      select: { profileImage: true },
    });
    return profile?.profileImage ?? null;
  } catch (error) {
    console.error("Failed to fetch profile image:", error);
    return null;
  }
};

export const fetchProfile = async () => {
  const user = await getAuthUser();
  const profile = await db.profile.findUnique({
    where: { clerkId: user.id },
  });

  if (!profile) redirect("/profile/create");
  return profile;
};

export const updateProfileAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  const user = await getAuthUser();
  try {
    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(profileSchema, rawData);

    await db.profile.update({
      where: {
        clerkId: user.id,
      },
      data: validatedFields,
    });
    revalidatePath("/profile");
    return { message: "Profile updated successfully" };
  } catch (error) {
    return renderError(error);
  }
};

export const updateProfileImageAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  const user = await getAuthUser();
  try {
    const image = formData.get("image") as string;
    const validatedFields = validateWithZodSchema(imageSchema, { image });

    await db.profile.update({
      where: {
        clerkId: user.id,
      },
      data: {
        profileImage: validatedFields.image,
      },
    });
    revalidatePath("/profile");
    return { message: "Profile image updated successfully" };
  } catch (error) {
    return renderError(error);
  }
};

export const createPropertyAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  const user = await getAuthUser();
  try {
    const rawData = Object.fromEntries(formData);
    const image = formData.get("image") as string;

    const validatedFields = validateWithZodSchema(propertySchema, rawData);
    const validatedImage = validateWithZodSchema(imageSchema, { image });

    await db.property.create({
      data: {
        ...validatedFields,
        image: validatedImage.image,
        profileId: user.id,
      },
    });
  } catch (error) {
    return renderError(error);
  }
  redirect("/");
};

export const fetchProperties = async ({
  search = "",
  category,
}: {
  search?: string;
  category?: string;
}) => {
  try {
    const properties = await db.property.findMany({
      where: {
        isOnHold: false,
        category,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { tagline: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        tagline: true,
        country: true,
        image: true,
        price: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return properties;
  } catch (error) {
    console.error("Failed to fetch properties:", error);
    return [];
  }
};

export const fetchFavoriteId = async ({
  propertyId,
}: {
  propertyId: string;
}) => {
  const user = await getAuthUser();
  const favorite = await db.favorite.findFirst({
    where: {
      propertyId,
      profileId: user.id,
    },
    select: {
      id: true,
    },
  });
  return favorite?.id || null;
};
// export const toggleFavoriteAction = async (prevState: {
//   propertyId: string;
//   favoriteId?: string | null;
//   pathname: string;
// }) => {
//   const user = await getAuthUser();
//   const { propertyId, favoriteId, pathname } = prevState;
//   try {
//     if (favoriteId) {
//       await db.favorite.delete({
//         where: {
//           id: favoriteId,
//         },
//       });
//     } else {
//       await db.favorite.create({
//         data: {
//           propertyId,
//           profileId: user.id,
//         },
//       });
//     }
//     revalidatePath(pathname);
//     return {
//       message: favoriteId ? "Removed from favorites" : "Added to favorites",
//     };
//   } catch (error) {
//     return renderError(error);
//   }
// };

export const toggleFavoriteAction = async (prevState: {
  propertyId: string;
  favoriteId: string | null;
  pathname: string;
}) => {
  const user = await getAuthUser();
  const { propertyId, favoriteId, pathname } = prevState;
  try {
    if (favoriteId) {
      await db.favorite.delete({
        where: {
          id: favoriteId,
        },
      });
    } else {
      await db.favorite.create({
        data: {
          propertyId,
          profileId: user.id,
        },
      });
    }
    revalidatePath(pathname);
    return { message: favoriteId ? "Removed from Faves" : "Added to Faves" };
  } catch (error) {
    return renderError(error);
  }
};

export const fetchFavorites = async () => {
  const user = await getAuthUser();
  const favorites = await db.favorite.findMany({
    where: {
      profileId: user.id,
    },
    select: {
      property: {
        select: {
          id: true,
          name: true,
          tagline: true,
          price: true,
          country: true,
          image: true,
          isOnHold: true,
        },
      },
    },
  });
  return favorites.map((favorite) => favorite.property);
};

export const fetchPropertyDetails = (id: string) => {
  return db.property.findUnique({
    where: {
      id,
    },
    include: {
      profile: true,
      bookings: {
        select: {
          checkIn: true,
          checkOut: true,
        },
      },
    },
  });
};

export async function createReviewAction(prevState: any, formData: FormData) {
  const user = await getAuthUser();
  try {
    const rawData = Object.fromEntries(formData);

    const validatedFields = validateWithZodSchema(createReviewSchema, rawData);
    await db.review.create({
      data: {
        ...validatedFields,
        profileId: user.id,
      },
    });
    revalidatePath(`/properties/${validatedFields.propertyId}`);
    return { message: "Review submitted successfully" };
  } catch (error) {
    return renderError(error);
  }
}
export async function fetchPropertyReviews(propertyId: string) {
  const reviews = await db.review.findMany({
    where: {
      propertyId,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      profile: {
        select: {
          firstName: true,
          profileImage: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return reviews;
}

export const fetchPropertyReviewsByUser = async () => {
  const user = await getAuthUser();
  const reviews = await db.review.findMany({
    where: {
      profileId: user.id,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      property: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });
  return reviews;
};

export const deleteReviewAction = async (prevState: { reviewId: string }) => {
  const { reviewId } = prevState;
  const user = await getAuthUser();

  try {
    await db.review.delete({
      where: {
        id: reviewId,
        profileId: user.id,
      },
    });

    revalidatePath("/reviews");
    return { message: "Review deleted successfully" };
  } catch (error) {
    return renderError(error);
  }
};

export async function fetchPropertyRating(propertyId: string) {
  const result = await db.review.groupBy({
    by: ["propertyId"],
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
    where: {
      propertyId,
    },
  });
  return {
    rating: result[0]?._avg.rating?.toFixed(1) ?? 0,
    count: result[0]?._count.rating ?? 0,
  };
}

export const findExistingReview = async (
  userId: string,
  propertyId: string
) => {
  return db.review.findFirst({
    where: {
      profileId: userId,
      propertyId: propertyId,
    },
  });
};

export const createBookingAction = async (prevState: {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
}) => {
  const user = await getAuthUser();
  await db.booking.deleteMany({
    where: {
      profileId: user.id,
      paymentStatus: false,
    },
  });
  let bookingId: null | string = null;

  const { propertyId, checkIn, checkOut } = prevState;
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { price: true },
  });
  if (!property) {
    return { message: "Property not found" };
  }
  const { orderTotal, totalNights } = calculateTotals({
    checkIn,
    checkOut,
    price: property.price,
  });

  try {
    const booking = await db.booking.create({
      data: {
        checkIn,
        checkOut,
        orderTotal,
        totalNights,
        // Payment is disabled for now, mark booking as paid immediately.
        paymentStatus: true,
        profileId: user.id,
        propertyId,
      },
    });
    bookingId = booking.id;
  } catch (error) {
    return renderError(error);
  }
  // redirect(`/checkout?bookingId=${bookingId}`);
  redirect("/bookings");
};

export const fetchBookings = async () => {
  const user = await getAuthUser();
  const bookings = await db.booking.findMany({
    where: {
      profileId: user.id,
      paymentStatus: true,
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return bookings;
};

export const deleteBookingAction = async (prevState: { bookingId: string }) => {
  const { bookingId } = prevState;
  const user = await getAuthUser();

  try {
    const result = await db.booking.delete({
      where: {
        id: bookingId,
        profileId: user.id,
      },
    });

    revalidatePath("/bookings");
    return { message: "Booking deleted successfully" };
  } catch (error) {
    return renderError(error);
  }
};

export const fetchRentals = async () => {
  const user = await getAuthUser();

  // Two queries total regardless of rental count (was 1 + 2×N before).
  const rentals = await db.property.findMany({
    where:  { profileId: user.id },
    select: { id: true, name: true, price: true, isOnHold: true },
  });

  const bookingStats = await db.booking.groupBy({
    by:    ["propertyId"],
    where: { propertyId: { in: rentals.map((r) => r.id) }, paymentStatus: true },
    _sum:  { totalNights: true, orderTotal: true },
  });

  const statsById = new Map(bookingStats.map((s) => [s.propertyId, s._sum]));

  return rentals.map((rental) => ({
    ...rental,
    totalNightsSum: statsById.get(rental.id)?.totalNights ?? null,
    orderTotalSum:  statsById.get(rental.id)?.orderTotal  ?? null,
  }));
};

export async function deleteRentalAction(prevState: { propertyId: string }) {
  const { propertyId } = prevState;
  const user = await getAuthUser();

  try {
    await db.property.delete({
      where: {
        id: propertyId,
        profileId: user.id,
      },
    });

    revalidatePath("/rentals");
    return { message: "Rental deleted successfully" };
  } catch (error) {
    return renderError(error);
  }
}

export const fetchRentalDetails = async (propertyId: string) => {
  const user = await getAuthUser();

  return db.property.findUnique({
    where: {
      id: propertyId,
      profileId: user.id,
    },
  });
};

export const updatePropertyAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  const user = await getAuthUser();
  const propertyId = formData.get("id") as string;

  try {
    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(propertySchema, rawData);
    await db.property.update({
      where: {
        id: propertyId,
        profileId: user.id,
      },
      data: {
        ...validatedFields,
      },
    });

    revalidatePath(`/rentals/${propertyId}/edit`);
    return { message: "Update Successful" };
  } catch (error) {
    return renderError(error);
  }
};

export const updatePropertyImageAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  const user = await getAuthUser();
  const propertyId = formData.get("id") as string;
  try {
    const image = formData.get("image") as string;
    const validatedFields = validateWithZodSchema(imageSchema, { image });
    await db.property.update({
      where: {
        id: propertyId,
        profileId: user.id,
      },
      data: {
        image: validatedFields.image,
      },
    });
    revalidatePath(`/rentals/${propertyId}/edit`);
    return { message: "update property image" };
  } catch (error) {
    return renderError(error);
  }
};

export const fetchReservations = async () => {
  const user = await getAuthUser();

  const reservations = await db.booking.findMany({
    where: {
      paymentStatus: true,
      property: {
        profileId: user.id,
      },
    },

    orderBy: {
      createdAt: "desc", // or 'asc' for ascending order
    },

    include: {
      property: {
        select: {
          id: true,
          name: true,
          price: true,
          country: true,
        },
      }, // include property details in the result
    },
  });
  return reservations;
};

export const fetchStats = async () => {
  await getAdminUser();

  const usersCount = await db.profile.count();
  const propertiesCount = await db.property.count();
  const bookingsCount = await db.booking.count({
    where: {
      paymentStatus: true,
    },
  });

  return {
    usersCount,
    propertiesCount,
    bookingsCount,
  };
};

export const fetchChartsData = async () => {
  await getAdminUser();
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  const sixMonthsAgo = date;

  const bookings = await db.booking.findMany({
    where: {
      paymentStatus: true,
      createdAt: { gte: sixMonthsAgo },
    },
    orderBy: { createdAt: "asc" },
    take:   5000,
    select: { createdAt: true },
  });
  let bookingsPerMonth = bookings.reduce((total, current) => {
    const date = formatDate(current.createdAt, true);

    const existingEntry = total.find((entry) => entry.date === date);
    if (existingEntry) {
      existingEntry.count += 1;
    } else {
      total.push({ date, count: 1 });
    }
    return total;
  }, [] as Array<{ date: string; count: number }>);
  return bookingsPerMonth;
};

const findBestCollectionReplacement = async (
  _collectionId: string,
  excludedPropertyIds: string[]
) => {
  const candidates = await db.property.findMany({
    where: {
      isOnHold: false,
      id: { notIn: excludedPropertyIds },
    },
    take: 60,
    orderBy: { updatedAt: "desc" },
    include: {
      reviews:  { select: { rating: true, comment: true } },
      bookings: { where: { paymentStatus: true }, select: { id: true } },
    },
  });

  if (candidates.length === 0) return null;

  const scored = candidates
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
      return { payload, score: payload.averageRating * 10 + payload.bookingCount };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.payload ?? null;
};

const swapHeldPropertyInCollections = async (
  heldPropertyId:    string,
  _heldPropertyName: string
): Promise<void> => {
  const affectedItems = await db.collectionItem.findMany({
    where: { propertyId: heldPropertyId },
    include: {
      collection: {
        select: {
          id: true,
          items: { select: { propertyId: true } },
        },
      },
    },
  });

  if (affectedItems.length === 0) return;

  await Promise.all(
    affectedItems.map(async (item: (typeof affectedItems)[number]) => {
      const idsInCollection = item.collection.items.map((i: { propertyId: string }) => i.propertyId);
      const excludedIds     = Array.from(new Set([...idsInCollection, heldPropertyId]));
      const replacement     = await findBestCollectionReplacement(item.collectionId, excludedIds);

      if (replacement) {
        return db.collectionItem.update({
          where: { id: item.id },
          data: {
            propertyId:    replacement.id,
            propertyName:  replacement.name,
            propertyImage: replacement.image,
            matchScore:    Math.round(replacement.averageRating * 10 + replacement.bookingCount),
          },
        });
      }
      return db.collectionItem.delete({ where: { id: item.id } });
    })
  );
};

// ── RecommendationSession invalidation and regeneration ──────────────────────
// Sessions from the last 30 days are eligible for invalidation/regeneration.
// Older sessions are kept as immutable historical record.
const REGEN_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Scores all currently-available properties against the given preferences and
// returns the top 20 sorted results. Used as the shared core for both hold and
// un-hold regeneration so the logic stays in one place.
const buildReplacementResults = async (preferences: UserPreferences) => {
  const candidates = await db.property.findMany({
    where:   { isOnHold: false },
    take:    100,
    orderBy: { updatedAt: "desc" },
    include: {
      reviews:  { select: { rating: true, comment: true } },
      bookings: { where: { paymentStatus: true }, select: { id: true } },
    },
  });

  const scored = candidates
    .map((p) => {
      const payload = toModelPayload({
        id:           p.id,
        name:         p.name,
        image:        p.image,
        category:     p.category,
        city:         p.city,
        country:      p.country,
        description:  p.description,
        price:        p.price,
        guests:       p.guests,
        amenitiesRaw: p.amenities,
        reviews:      p.reviews,
        bookingCount: p.bookings.length,
      });
      const { score, reasons } = computeBackendScore(preferences, payload);
      return { payload, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return { scored, totalAnalyzed: candidates.length };
};

// Creates a new active RecommendationSession that supersedes an old (invalidated)
// one, and writes the supersededById link back onto the old session.
const createSupersedingSession = async (
  oldSessionId: string,
  profileId:    string,
  preferences:  UserPreferences,
  aiSummary:    string
): Promise<void> => {
  const { scored, totalAnalyzed } = await buildReplacementResults(preferences);
  if (scored.length === 0) return;

  const newSession = await db.recommendationSession.create({
    data: {
      profileId,
      preferences:    preferences as object,
      topMatchReason: scored[0].reasons[0] ?? aiSummary,
      totalAnalyzed,
      modelUsed:      "regenerated-backend",
      status:         "active",
      results: {
        create: scored.map(({ payload, score, reasons }, idx) => ({
          propertyId:     payload.id,
          propertyName:   payload.name,
          rank:           idx + 1,
          matchScore:     score,
          matchReasons:   reasons,
          strengths:      [`Rating: ${payload.averageRating}`, `Bookings: ${payload.bookingCount}`],
          concerns:       [],
          reviewInsights: { commonPositiveThemes: [], commonNegativeThemes: [] },
          budgetFit:      { withinBudget: true, priceAssessment: "" },
          amenityMatch:   { matched: [], missing: [] },
          aiSummary:      reasons[0] ?? aiSummary,
        })),
      },
    },
  });

  await db.recommendationSession.update({
    where: { id: oldSessionId },
    data:  { supersededById: newSession.id },
  });
};

// Called when a property goes ON hold.
// Finds active sessions from the last 30 days that referenced this property,
// marks them invalidated, then regenerates one fresh session per affected user
// (using the most recent session's stored preferences, excluding held properties).
const invalidateAndRegenerateSessionsForHold = async (
  heldPropertyId:   string,
  heldPropertyName: string
): Promise<void> => {
  const since = new Date(Date.now() - REGEN_LOOKBACK_MS);

  const affected = await db.recommendationSession.findMany({
    where: {
      status:    "active",
      createdAt: { gte: since },
      results:   { some: { propertyId: heldPropertyId } },
    },
    select: { id: true, profileId: true, preferences: true, createdAt: true },
  });

  if (affected.length === 0) return;

  await db.recommendationSession.updateMany({
    where: { id: { in: affected.map((s) => s.id) } },
    data: {
      status:             "invalidated",
      invalidatedAt:      new Date(),
      invalidationReason: `Property "${heldPropertyName}" was put on hold`,
    },
  });

  // De-duplicate by user: if a user had multiple affected sessions, only
  // regenerate from the most recent one to avoid redundant new sessions.
  const perUser = new Map<string, (typeof affected)[number]>();
  for (const s of affected) {
    if (!s.profileId) continue;
    const existing = perUser.get(s.profileId);
    if (!existing || s.createdAt > existing.createdAt) perUser.set(s.profileId, s);
  }

  for (const [profileId, session] of Array.from(perUser.entries())) {
    await createSupersedingSession(
      session.id,
      profileId,
      session.preferences as unknown as UserPreferences,
      "Regenerated after property hold"
    );
  }
};

// Called when a property comes OFF hold.
// Finds invalidated sessions from the last 30 days that referenced this property
// and regenerates one fresh session per affected user, now with the property
// back in the candidate pool.
const regenerateSessionsForUnhold = async (
  propertyId:   string,
  propertyName: string
): Promise<void> => {
  const since = new Date(Date.now() - REGEN_LOOKBACK_MS);

  const affected = await db.recommendationSession.findMany({
    where: {
      status:    "invalidated",
      createdAt: { gte: since },
      results:   { some: { propertyId } },
    },
    select: { id: true, profileId: true, preferences: true, createdAt: true },
  });

  if (affected.length === 0) return;

  const perUser = new Map<string, (typeof affected)[number]>();
  for (const s of affected) {
    if (!s.profileId) continue;
    const existing = perUser.get(s.profileId);
    if (!existing || s.createdAt > existing.createdAt) perUser.set(s.profileId, s);
  }

  for (const [profileId, session] of Array.from(perUser.entries())) {
    await createSupersedingSession(
      session.id,
      profileId,
      session.preferences as unknown as UserPreferences,
      `Regenerated after "${propertyName}" was reinstated`
    );
  }
};

export const togglePropertyHoldAction = async (prevState: {
  propertyId:        string;
  currentHoldStatus: boolean;
}): Promise<{ message: string }> => {
  await getAdminUser();
  const { propertyId, currentHoldStatus } = prevState;
  const newHoldStatus = !currentHoldStatus;

  try {
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { name: true },
    });
    if (!property) return { message: "Property not found" };

    await db.property.update({
      where: { id: propertyId },
      data:  { isOnHold: newHoldStatus },
    });

    if (newHoldStatus) {
      await swapHeldPropertyInCollections(propertyId, property.name);
      await invalidateAndRegenerateSessionsForHold(propertyId, property.name);
    } else {
      await regenerateSessionsForUnhold(propertyId, property.name);
    }

    revalidatePath("/admin/listings");
    return {
      message: newHoldStatus
        ? `"${property.name}" put on hold. Collections and recent recommendations updated.`
        : `"${property.name}" is back on the market. Recommendations regenerated.`,
    };
  } catch (error) {
    return renderError(error);
  }
};

export const toggleHostPropertyHoldAction = async (prevState: {
  propertyId: string;
  currentHoldStatus: boolean;
}): Promise<{ message: string }> => {
  const user = await getAuthUser();
  const { propertyId, currentHoldStatus } = prevState;
  const newHoldStatus = !currentHoldStatus;
  try {
    await db.property.update({
      where: { id: propertyId, profileId: user.id },
      data: { isOnHold: newHoldStatus },
    });
    revalidatePath("/rentals");
    return {
      message: newHoldStatus
        ? "Property put on hold. It will not appear in listings or recommendations."
        : "Property is back on the market.",
    };
  } catch (error) {
    return renderError(error);
  }
};

export const fetchAllPropertiesForAdmin = async () => {
  await getAdminUser();
  return db.property.findMany({
    take:    500,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      category: true,
      city: true,
      country: true,
      price: true,
      image: true,
      guests: true,
      bedrooms: true,
      beds: true,
      baths: true,
      amenities: true,
      isOnHold: true,
      createdAt: true,
      _count: {
        select: { bookings: true, reviews: true },
      },
    },
  });
};

export const adminFetchPropertyDetails = async (propertyId: string) => {
  await getAdminUser();
  return db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      category: true,
      country: true,
      price: true,
      image: true,
      guests: true,
      bedrooms: true,
      beds: true,
      baths: true,
      amenities: true,
      isOnHold: true,
    },
  });
};

export const adminUpdatePropertyAction = async (
  prevState: any,
  formData: FormData
): Promise<{ message: string }> => {
  await getAdminUser();
  const propertyId = formData.get("id") as string;
  try {
    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(propertySchema, rawData);
    await db.property.update({ where: { id: propertyId }, data: validatedFields });
    revalidatePath("/admin/listings");
    return { message: "Listing updated." };
  } catch (error) {
    return renderError(error);
  }
};

export const adminDeletePropertyAction = async ({
  propertyId,
}: {
  propertyId: string;
}): Promise<{ message: string }> => {
  await getAdminUser();
  try {
    await db.property.delete({ where: { id: propertyId } });
    revalidatePath("/admin/listings");
    return { message: "Listing deleted." };
  } catch (error) {
    return renderError(error);
  }
};

export const fetchReservationStats = async () => {
  const user = await getAuthUser();
  const properties = await db.property.count({
    where: {
      profileId: user.id,
    },
  });

  const totals = await db.booking.aggregate({
    _sum: {
      orderTotal: true,
      totalNights: true,
    },
    where: {
      property: {
        profileId: user.id,
      },
    },
  });

  return {
    properties,
    nights: totals._sum.totalNights || 0,
    amount: totals._sum.orderTotal || 0,
  };
}

// ── Collections ──

export const saveToCollectionAction = async (prevState: {
  propertyId:    string;
  propertyName:  string;
  propertyImage: string;
  matchScore:    number;
  country:       string;
  city:          string;
}): Promise<{ message: string }> => {
  const user = await getAuthUser();
  const { propertyId, propertyName, propertyImage, matchScore, country, city } = prevState;
  const collectionName = city ? `${city}, ${country}` : country;
  try {
    const collection = await db.collection.upsert({
      where: {
        profileId_country_city: { profileId: user.id, country, city },
      },
      update: {},
      create: { profileId: user.id, country, city, name: collectionName },
    });
    await db.collectionItem.create({
      data: { collectionId: collection.id, propertyId, propertyName, propertyImage, matchScore },
    });
    return { message: `Saved to your ${collectionName} collection` };
  } catch (error) {
    if ((error as any)?.code === "P2002") {
      return { message: "Already saved to this collection" };
    }
    return renderError(error);
  }
};

export const fetchUserCollections = async () => {
  const user = await getAuthUser();
  const collections = await db.collection.findMany({
    where:   { profileId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      items:  { orderBy: { addedAt: "desc" } },
      _count: { select: { items: true } },
    },
  });

  // Fetch hold status for all referenced properties in one query
  const allPropertyIds = collections.flatMap((c) => c.items.map((i) => i.propertyId));
  const heldProperties = await db.property.findMany({
    where: { id: { in: allPropertyIds }, isOnHold: true },
    select: { id: true },
  });
  const heldSet = new Set(heldProperties.map((p) => p.id));

  return collections.map((collection) => ({
    ...collection,
    items: collection.items.map((item) => ({
      ...item,
      isOnHold: heldSet.has(item.propertyId),
    })),
  }));
};

export const removeFromCollectionAction = async (prevState: {
  itemId: string;
}): Promise<{ message: string }> => {
  const user = await getAuthUser();
  try {
    await db.collectionItem.delete({
      where: {
        id:         prevState.itemId,
        collection: { profileId: user.id },
      },
    });
    revalidatePath("/collections");
    return { message: "Removed from collection" };
  } catch (error) {
    return renderError(error);
  }
};

// Sessions older than 90 days are deleted. RecommendationResult rows cascade automatically.
export const cleanupOldRecommendationSessionsAction = async (): Promise<{ message: string }> => {
  await getAdminUser();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await db.recommendationSession.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { message: `Pruned ${count} recommendation session${count !== 1 ? "s" : ""} older than 90 days.` };
};

export const fetchRecommendationSessions = async () => {
  await getAdminUser();
  return db.recommendationSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      profile: {
        select: { firstName: true, lastName: true, email: true },
      },
      results: {
        orderBy: { rank: "asc" },
        select: {
          id: true,
          propertyId: true,
          propertyName: true,
          rank: true,
          matchScore: true,
          aiSummary: true,
          replacedPropertyId: true,
          replacedPropertyName: true,
          replacedAt: true,
          replacedReason: true,
        },
      },
    },
  });
};

