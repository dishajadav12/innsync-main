"use client";

import Link from "next/link";
import { EditPropertySheet } from "@/components/admin/EditPropertySheet";

type PropertyData = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  country: string;
  price: number;
  image: string;
  guests: number;
  bedrooms: number;
  beds: number;
  baths: number;
  amenities: string;
  isOnHold: boolean;
};

export function AdminListingActions({ property }: { property: PropertyData }) {
  return (
    <div className="flex items-center gap-x-2">
      <Link
        href={`/properties/${property.id}`}
        className="text-sm text-primary hover:underline"
      >
        View
      </Link>
      <EditPropertySheet property={property} />
    </div>
  );
}
