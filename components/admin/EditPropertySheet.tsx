"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HoldToggleButton } from "@/components/admin/HoldToggleButton";
import FormContainer from "@/components/form/FormContainer";
import FormInput from "@/components/form/FormInput";
import CategoriesInput from "@/components/form/CategoriesInput";
import PriceInput from "@/components/form/PriceInput";
import TextAreaInput from "@/components/form/TextAreaInput";
import CountriesInput from "@/components/form/CountriesInput";
import CounterInput from "@/components/form/CounterInput";
import AmenitiesInput from "@/components/form/AmenitiesInput";
import { SubmitButton } from "@/components/form/Buttons";
import ImageInputContainer from "@/components/form/ImageInputContainer";
import { useToast } from "@/components/ui/use-toast";
import { amenities as allAmenities, type Amenity } from "@/utils/amenities";
import {
  adminUpdatePropertyAction,
  adminDeletePropertyAction,
  updatePropertyImageAction,
} from "@/utils/actions";

function parseAmenities(raw: string): Amenity[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Amenity[];
  } catch {
    // fall through
  }
  const selected = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return allAmenities.map((a) => ({ ...a, selected: selected.has(a.name) }));
}

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

export function EditPropertySheet({ property }: { property: PropertyData }) {
  const defaultAmenities: Amenity[] = parseAmenities(property.amenities);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!window.confirm("Delete this property? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await adminDeletePropertyAction({ propertyId: property.id });
      toast({ description: result.message });
      if (!result.message.toLowerCase().includes("error")) {
        setOpen(false);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <div className="flex items-center justify-between mb-6 pr-8">
          <h2 className="text-lg font-semibold">Edit Property</h2>
          <div className="flex items-center gap-2">
            <HoldToggleButton propertyId={property.id} isOnHold={property.isOnHold} />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting..." : "Delete Property"}
            </Button>
          </div>
        </div>

        <ImageInputContainer
          name={property.name}
          text="Update Image"
          action={updatePropertyImageAction}
          image={property.image}
          disabled={true}
        >
          <input type="hidden" name="id" value={property.id} />
        </ImageInputContainer>

        <FormContainer action={adminUpdatePropertyAction}>
          <input type="hidden" name="id" value={property.id} />
          <div className="grid md:grid-cols-2 gap-8 mb-4 mt-8">
            <FormInput
              name="name"
              type="text"
              label="Name (20 limit)"
              defaultValue={property.name}
            />
            <FormInput
              name="tagline"
              type="text"
              label="Tagline (30 limit)"
              defaultValue={property.tagline}
            />
            <PriceInput defaultValue={property.price} />
            <CategoriesInput defaultValue={property.category} />
            <CountriesInput defaultValue={property.country} />
          </div>

          <TextAreaInput
            name="description"
            labelText="Description (10 - 100 Words)"
            defaultValue={property.description}
          />

          <h3 className="text-lg mt-8 mb-4 font-medium">Accommodation Details</h3>
          <CounterInput detail="guests" defaultValue={property.guests} />
          <CounterInput detail="bedrooms" defaultValue={property.bedrooms} />
          <CounterInput detail="beds" defaultValue={property.beds} />
          <CounterInput detail="baths" defaultValue={property.baths} />

          <AmenitiesInput defaultValue={defaultAmenities} />
          <h3 className="text-lg mt-10 mb-6 font-medium">Amenities</h3>

          <SubmitButton text="update property" className="mt-12" />
        </FormContainer>
      </SheetContent>
    </Sheet>
  );
}
