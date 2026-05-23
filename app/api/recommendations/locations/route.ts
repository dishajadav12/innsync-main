import db from "@/utils/db";
import { destinations } from "@/utils/destinations";

const MIN_PROPERTIES_PER_CITY = 5;

export const GET = async () => {
  try {
    const grouped = await db.property.groupBy({
      by: ["country", "city"],
      _count: {
        _all: true,
      },
      where: {
        city: {
          not: null,
        },
      },
    });

    const cityAvailability = new Map<string, number>();
    grouped.forEach((item) => {
      if (!item.city) return;
      cityAvailability.set(`${item.country}::${item.city}`, item._count._all);
    });

    const availableDestinations = destinations
      .map((destination) => {
        const cities = destination.cities.filter((city) => {
          const key = `${destination.countryCode}::${city}`;
          return (cityAvailability.get(key) ?? 0) >= MIN_PROPERTIES_PER_CITY;
        });

        if (cities.length === 0) {
          return null;
        }

        return {
          countryCode: destination.countryCode,
          countryName: destination.countryName,
          cities,
        };
      })
      .filter((destination): destination is { countryCode: string; countryName: string; cities: string[] } =>
        Boolean(destination)
      );

    return Response.json({ destinations: availableDestinations }, { status: 200 });
  } catch {
    return Response.json({ destinations: [] }, { status: 200 });
  }
};
