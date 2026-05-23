import { PrismaClient } from "@prisma/client";
import { getCitiesForCountry } from "../utils/destinations";

const prisma = new PrismaClient();

type ProfileSeed = {
  clerkId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  profileImage: string;
};

type PropertySeed = {
  name: string;
  tagline: string;
  category: string;
  city: string;
  image: string;
  country: string;
  description: string;
  price: number;
  guests: number;
  bedrooms: number;
  beds: number;
  baths: number;
  amenities: string;
  profileId: string;
};

const profileSeeds: ProfileSeed[] = [
  {
    clerkId: "user_001",
    firstName: "Emma",
    lastName: "Johnson",
    username: "emmaj",
    email: "emma@example.com",
    profileImage:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80",
  },
  {
    clerkId: "user_002",
    firstName: "Michael",
    lastName: "Brown",
    username: "mikeb",
    email: "michael@example.com",
    profileImage:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
  },
  {
    clerkId: "user_003",
    firstName: "Sophia",
    lastName: "Lee",
    username: "sophial",
    email: "sophia@example.com",
    profileImage:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  },
  {
    clerkId: "user_004",
    firstName: "Daniel",
    lastName: "Smith",
    username: "daniels",
    email: "daniel@example.com",
    profileImage:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
  },
];

const imageUrls = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1464890100898-a385f744067f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1472220625704-91e1462799b2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=1200&q=80",
];

const categoryPool = [
  "cabin",
  "tent",
  "airstream",
  "cottage",
  "container",
  "caravan",
  "tiny",
  "magic",
  "warehouse",
  "lodge",
];

const countryPool = ["US", "CA", "PT", "CH", "AU", "NZ", "ES", "IT", "JP", "NO", "MA"];
const adjectives = [
  "Ocean",
  "Mountain",
  "Forest",
  "Skyline",
  "Sunset",
  "Lakeside",
  "Cozy",
  "Modern",
  "Rustic",
  "Hidden",
  "Serene",
  "Golden",
];
const placeTypes = [
  "Villa",
  "Cabin",
  "Retreat",
  "Studio",
  "Loft",
  "House",
  "Chalet",
  "Suite",
  "Hideaway",
  "Bungalow",
];
const taglineParts = [
  "perfect for couples",
  "ideal for remote work",
  "close to local attractions",
  "with scenic views",
  "with private outdoor space",
  "in a peaceful neighborhood",
  "great for family trips",
  "for a relaxing weekend",
  "with modern amenities",
  "for adventure seekers",
];
const amenityPool = [
  "wifi",
  "kitchen",
  "parking",
  "self-checkin",
  "workspace",
  "air-conditioning",
  "washing-machine",
  "heating",
  "coffee-machine",
  "fireplace",
  "pool",
  "bbq",
  "lake-view",
  "ocean-view",
  "city-view",
  "breakfast",
];

const pickAmenities = (index: number) => {
  const start = index % amenityPool.length;
  const picked = new Set<string>();
  for (let i = 0; i < 6; i += 1) {
    picked.add(amenityPool[(start + i * 2) % amenityPool.length]);
  }
  return Array.from(picked).join(",");
};

const buildGeneratedProperties = (profileIds: string[]): PropertySeed[] => {
  const rows: PropertySeed[] = [];
  let index = 0;

  for (const country of countryPool) {
    const cities = getCitiesForCountry(country);
    for (const city of cities) {
      for (let c = 0; c < categoryPool.length; c += 1) {
        const adjective = adjectives[index % adjectives.length];
        const placeType = placeTypes[index % placeTypes.length];
        const category = categoryPool[c];
        const image = imageUrls[index % imageUrls.length];
        const profileId = profileIds[index % profileIds.length];

        rows.push({
          name: `${adjective} ${placeType} ${index + 1}`,
          tagline: `${adjective.toLowerCase()} stay ${taglineParts[index % taglineParts.length]}`,
          category,
          city,
          image,
          country,
          description: `A ${category} stay in ${city}, ${country} with comfort-focused design, thoughtful interiors, and easy access to nearby spots.`,
          price: 90 + ((index * 17) % 360),
          guests: 1 + (index % 8),
          bedrooms: 1 + (index % 5),
          beds: 1 + (index % 6),
          baths: 1 + (index % 4),
          amenities: pickAmenities(index),
          profileId,
        });
        index += 1;
      }
    }
  }

  return rows;
};

async function main() {
  console.log("Starting seed...");

  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.property.deleteMany();
  await prisma.profile.deleteMany();

  const profiles = await Promise.all(
    profileSeeds.map((profile) => prisma.profile.create({ data: profile }))
  );
  console.log(`Profiles created: ${profiles.length}`);

  const baseProperties = await Promise.all([
    prisma.property.create({
      data: {
        name: "Ocean Breeze Villa",
        tagline: "Luxury beach escape with private pool",
        category: "cottage",
        city: "Miami",
        image: imageUrls[0],
        country: "US",
        description: "Beautiful oceanfront villa perfect for relaxing vacations.",
        price: 420,
        guests: 6,
        bedrooms: 3,
        beds: 4,
        baths: 2,
        amenities: "wifi,pool,ocean-view,kitchen,parking,air-conditioning",
        profileId: profiles[0].clerkId,
      },
    }),
    prisma.property.create({
      data: {
        name: "Mountain Cabin Retreat",
        tagline: "Peaceful cabin surrounded by hiking trails",
        category: "cabin",
        city: "Vancouver",
        image: imageUrls[1],
        country: "CA",
        description: "Cozy cabin with fireplace and amazing mountain views.",
        price: 180,
        guests: 4,
        bedrooms: 2,
        beds: 2,
        baths: 1,
        amenities: "wifi,fireplace,hiking,parking,kitchen",
        profileId: profiles[1].clerkId,
      },
    }),
    prisma.property.create({
      data: {
        name: "Skyline Penthouse",
        tagline: "Modern luxury in the heart of downtown",
        category: "warehouse",
        city: "New York",
        image: imageUrls[2],
        country: "US",
        description: "Perfect for business travelers and city explorers.",
        price: 350,
        guests: 3,
        bedrooms: 2,
        beds: 2,
        baths: 2,
        amenities: "wifi,gym,workspace,parking,self-checkin",
        profileId: profiles[2].clerkId,
      },
    }),
    prisma.property.create({
      data: {
        name: "Desert Dome Stay",
        tagline: "Unique glamping under the stars",
        category: "magic",
        city: "Marrakech",
        image: imageUrls[3],
        country: "MA",
        description: "A magical desert experience with luxury tents.",
        price: 240,
        guests: 2,
        bedrooms: 1,
        beds: 1,
        baths: 1,
        amenities: "breakfast,desert-view,parking,campfire",
        profileId: profiles[3].clerkId,
      },
    }),
    prisma.property.create({
      data: {
        name: "Remote Work Haven",
        tagline: "Built for digital nomads",
        category: "tiny",
        city: "Lisbon",
        image: imageUrls[4],
        country: "PT",
        description: "Fast wifi and ergonomic workspace for long stays.",
        price: 210,
        guests: 2,
        bedrooms: 1,
        beds: 1,
        baths: 1,
        amenities: "wifi,workspace,coffee-machine,kitchen,self-checkin",
        profileId: profiles[0].clerkId,
      },
    }),
    prisma.property.create({
      data: {
        name: "Family Lake House",
        tagline: "Spacious getaway for families",
        category: "lodge",
        city: "Lucerne",
        image: imageUrls[5],
        country: "CH",
        description: "Kid-friendly property near beautiful lake views.",
        price: 300,
        guests: 8,
        bedrooms: 4,
        beds: 5,
        baths: 3,
        amenities: "wifi,kitchen,parking,lake-view,washing-machine",
        profileId: profiles[1].clerkId,
      },
    }),
  ]);
  console.log(`Base properties created: ${baseProperties.length}`);

  const generatedProperties = buildGeneratedProperties(
    profiles.map((p) => p.clerkId)
  );

  await prisma.property.createMany({ data: generatedProperties });
  console.log(`Generated properties created: ${generatedProperties.length}`);

  await prisma.favorite.createMany({
    data: [
      {
        profileId: profiles[0].clerkId,
        propertyId: baseProperties[1].id,
      },
      {
        profileId: profiles[0].clerkId,
        propertyId: baseProperties[2].id,
      },
      {
        profileId: profiles[1].clerkId,
        propertyId: baseProperties[0].id,
      },
      {
        profileId: profiles[2].clerkId,
        propertyId: baseProperties[4].id,
      },
      {
        profileId: profiles[3].clerkId,
        propertyId: baseProperties[0].id,
      },
    ],
  });
  console.log("Favorites created");

  await prisma.review.createMany({
    data: [
      {
        profileId: profiles[0].clerkId,
        propertyId: baseProperties[0].id,
        rating: 5,
        comment: "Amazing ocean view and very clean!",
      },
      {
        profileId: profiles[1].clerkId,
        propertyId: baseProperties[1].id,
        rating: 4,
        comment: "Perfect hiking getaway.",
      },
      {
        profileId: profiles[2].clerkId,
        propertyId: baseProperties[2].id,
        rating: 5,
        comment: "Excellent workspace and fast wifi.",
      },
      {
        profileId: profiles[3].clerkId,
        propertyId: baseProperties[3].id,
        rating: 4,
        comment: "Unique experience and beautiful night sky.",
      },
      {
        profileId: profiles[0].clerkId,
        propertyId: baseProperties[4].id,
        rating: 5,
        comment: "Best place for remote work.",
      },
      {
        profileId: profiles[2].clerkId,
        propertyId: baseProperties[5].id,
        rating: 4,
        comment: "Very spacious and family friendly.",
      },
    ],
  });
  console.log("Reviews created");

  await prisma.booking.createMany({
    data: [
      {
        profileId: profiles[0].clerkId,
        propertyId: baseProperties[2].id,
        orderTotal: 1050,
        totalNights: 3,
        checkIn: new Date("2026-06-10T00:00:00.000Z"),
        checkOut: new Date("2026-06-13T00:00:00.000Z"),
        paymentStatus: true,
      },
      {
        profileId: profiles[1].clerkId,
        propertyId: baseProperties[1].id,
        orderTotal: 720,
        totalNights: 4,
        checkIn: new Date("2026-07-01T00:00:00.000Z"),
        checkOut: new Date("2026-07-05T00:00:00.000Z"),
        paymentStatus: true,
      },
      {
        profileId: profiles[2].clerkId,
        propertyId: baseProperties[4].id,
        orderTotal: 630,
        totalNights: 3,
        checkIn: new Date("2026-08-12T00:00:00.000Z"),
        checkOut: new Date("2026-08-15T00:00:00.000Z"),
        paymentStatus: true,
      },
      {
        profileId: profiles[3].clerkId,
        propertyId: baseProperties[3].id,
        orderTotal: 480,
        totalNights: 2,
        checkIn: new Date("2026-09-20T00:00:00.000Z"),
        checkOut: new Date("2026-09-22T00:00:00.000Z"),
        paymentStatus: true,
      },
    ],
  });
  console.log("Bookings created");

  const totalProperties = await prisma.property.count();
  console.log(`Seed completed. Total properties in DB: ${totalProperties}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
