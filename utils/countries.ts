// import countries from "world-countries";

// export const formattedCountries = countries.map((item) => ({
//   code: item.cca2,
//   name: item.name.common,
//   flag: item.flag,
//   location: item.latlng,
//   region: item.region,
// }));
// export const findCountryByCode = (code: string) =>
//   formattedCountries.find((item) => item.code === code);

import countries from "world-countries";
export const formattedCountries = countries.map((item) => ({
  code: item.cca2,
  name: item.name.common,
  flag: `https://flagcdn.com/w320/${item.cca2.toLowerCase()}.png`,
  location: item.latlng,
  region: item.region,
}));
export const findCountryByCode = (code: string) =>
  formattedCountries.find((item) => item.code === code);
