import { formattedCountries } from "@/utils/countries";

type DestinationSeed = {
  countryCode: string;
  cities: string[];
};

const destinationSeeds: DestinationSeed[] = [
  { countryCode: "US", cities: ["New York", "Los Angeles", "Miami", "Seattle", "Denver"] },
  { countryCode: "CA", cities: ["Toronto", "Vancouver", "Montreal", "Calgary", "Quebec City"] },
  { countryCode: "PT", cities: ["Lisbon", "Porto", "Faro", "Madeira", "Sintra"] },
  { countryCode: "CH", cities: ["Zurich", "Geneva", "Lucerne", "Interlaken", "Zermatt"] },
  { countryCode: "AU", cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Gold Coast"] },
  { countryCode: "NZ", cities: ["Auckland", "Wellington", "Queenstown", "Christchurch", "Rotorua"] },
  { countryCode: "ES", cities: ["Barcelona", "Madrid", "Seville", "Valencia", "Malaga"] },
  { countryCode: "IT", cities: ["Rome", "Florence", "Venice", "Milan", "Naples"] },
  { countryCode: "JP", cities: ["Tokyo", "Kyoto", "Osaka", "Sapporo", "Fukuoka"] },
  { countryCode: "NO", cities: ["Oslo", "Bergen", "Tromso", "Stavanger", "Alesund"] },
  { countryCode: "MA", cities: ["Marrakech", "Casablanca", "Fes", "Essaouira", "Rabat"] },
];

export type Destination = {
  countryCode: string;
  countryName: string;
  flag?: string;
  cities: string[];
};

export const destinations: Destination[] = destinationSeeds
  .map((seed) => {
    const country = formattedCountries.find((item) => item.code === seed.countryCode);

    if (!country) {
      return null;
    }

    return {
      countryCode: country.code,
      countryName: country.name,
      flag: country.flag,
      cities: seed.cities,
    };
  })
  .filter((destination): destination is Destination => Boolean(destination));

export const getDestinationByCountryCode = (countryCode: string) =>
  destinations.find((item) => item.countryCode === countryCode);

export const getCitiesForCountry = (countryCode: string) =>
  getDestinationByCountryCode(countryCode)?.cities ?? [];
