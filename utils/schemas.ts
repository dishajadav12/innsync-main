import * as z from "zod";
import { ZodSchema } from "zod";

export const profileSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters long",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters long",
  }),
  username: z.string().min(2, {
    message: "Username must be at least 2 characters long",
  }),
});

export function validateWithZodSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((error) => error.message);
    throw new Error(errors.join(", "));
  }
  return result.data;
}

export const imageSchema = z.object({
  image: z
    .string()
    .url({ message: "Image must be a valid URL" })
    .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
      message: "Image URL must start with http:// or https://",
    })
    .refine((value) => {
      try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.toLowerCase();

        if (host === "unsplash.com" && path.startsWith("/photos/")) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    }, {
      message:
        "Please use a direct image URL (for Unsplash use images.unsplash.com, not unsplash.com/photos/...)",
    }),
});

export const propertySchema = z.object({
  name: z
    .string()
    .min(2, {
      message: "name must be at least 2 characters.",
    })
    .max(100, {
      message: "name must be less than 100 characters.",
    }),
  tagline: z
    .string()
    .min(2, {
      message: "tagline must be at least 2 characters.",
    })
    .max(100, {
      message: "tagline must be less than 100 characters.",
    }),
  price: z.coerce.number().int().min(0, {
    message: "price must be a positive number.",
  }),
  category: z.string(),
  description: z.string().refine(
    (description) => {
      const wordCount = description.split(" ").length;
      return wordCount >= 10 && wordCount <= 1000;
    },
    {
      message: "description must be between 10 and 1000 words.",
    }
  ),
  country: z.string(),
  guests: z.coerce.number().int().min(0, {
    message: "guest amount must be a positive number.",
  }),
  bedrooms: z.coerce.number().int().min(0, {
    message: "bedrooms amount must be a positive number.",
  }),
  beds: z.coerce.number().int().min(0, {
    message: "beds amount must be a positive number.",
  }),
  baths: z.coerce.number().int().min(0, {
    message: "bahts amount must be a positive number.",
  }),
  amenities: z.string(),
});

export const createReviewSchema = z.object({
  propertyId: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000),
});

