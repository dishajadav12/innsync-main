import { Amenity } from "@/utils/amenities";
import { LuFolderCheck } from "react-icons/lu";
import Title from "./Title";

function Amenities({ amenities }: { amenities: string }) {
  const amenitiesList: Amenity[] = (() => {
    if (!amenities) return [];

    try {
      const parsed = JSON.parse(amenities as string);

      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
          return parsed
            .map((item) => ({
              name: String(item.name ?? "").toLowerCase().trim(),
              selected: Boolean(item.selected),
              icon: item.icon,
            }))
            .filter((item) => item.name);
        }

        return parsed
          .map((item) => ({
            name: String(item).toLowerCase().trim(),
            selected: true,
            icon: undefined,
          }))
          .filter((item) => item.name) as Amenity[];
      }
    } catch {
      return amenities
        .split(",")
        .map((item) => ({
          name: item.toLowerCase().trim(),
          selected: true,
          icon: undefined,
        }))
        .filter((item) => item.name) as Amenity[];
    }

    return [];
  })();

  const noAmenities = amenitiesList.every((amenity) => !amenity.selected);

  if (noAmenities) {
    return null;
  }
  return (
    <div className="mt-4">
      <Title text="What this place offers" />
      <div className="grid md:grid-cols-2 gap-x-4">
        {amenitiesList.map((amenity) => {
          if (!amenity.selected) {
            return null;
          }
          return (
            <div key={amenity.name} className="flex items-center gap-x-4 mb-2 ">
              <LuFolderCheck className="h-6 w-6 text-primary" />
              <span className="font-light text-sm capitalize">
                {amenity.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default Amenities;