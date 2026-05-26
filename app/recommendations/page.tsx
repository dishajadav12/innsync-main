"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToCollectionButton } from "@/components/recommendations/SaveToCollectionButton";

type LocationDestination = {
  countryCode: string;
  countryName: string;
  cities: string[];
};

type WizardSelections = {
  country: string;
  city: string;
  tripType: string[];
  category: string[];
  amenity: string[];
  vibe: string[];
  budget: { min: number; max: number };
  guests: number;
};

type RecommendationResponse = {
  summary: {
    topMatchReason: string;
    totalAnalyzed: number;
  };
  recommendations: Array<{
    propertyId: string;
    propertyName: string;
    propertyImage?: string;
    city?: string;
    state?: string;
    matchScore: number;
    matchReasons: string[];
    strengths: string[];
    concerns: string[];
    reviewInsights: {
      commonPositiveThemes: string[];
      commonNegativeThemes: string[];
    };
    budgetFit: {
      withinBudget: boolean;
      priceAssessment: string;
    };
    amenityMatch: {
      matched: string[];
      missing: string[];
    };
    aiSummary: string;
  }>;
};

const tripTypeOptions = [
  "relaxation",
  "luxury",
  "family trip",
  "workcation",
  "adventure",
  "romantic",
];

const categoryOptions = [
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

const amenityOptions = [
  "wifi",
  "workspace",
  "pool",
  "kitchen",
  "parking",
  "air conditioning",
  "hot shower",
  "heating",
  "bbq grill",
  "first aid kit",
];

const vibeOptions = [
  "peaceful",
  "luxury",
  "romantic",
  "nature",
  "family-friendly",
  "remote work friendly",
];

const initialState: WizardSelections = {
  country: "",
  city: "",
  tripType: [],
  category: [],
  amenity: [],
  vibe: [],
  budget: { min: 50, max: 500 },
  guests: 2,
};

function MultiSelectGrid({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  maxSelected = 3,
}: {
  title: string;
  subtitle: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  maxSelected?: number;
}) {
  const selectedCount = selected.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-sm sm:text-base font-semibold">{title}</p>
        <p className="text-[11px] sm:text-xs text-muted-foreground">
          {selectedCount}/{maxSelected} selected
        </p>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-4">{subtitle}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          const isDisabled = !isSelected && selectedCount >= maxSelected;

          return (
            <button
              type="button"
              key={option}
              onClick={() => onToggle(option)}
              disabled={isDisabled}
              className={`rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <p className="text-xs sm:text-sm font-medium capitalize">{option}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropdownField({
  label,
  placeholder,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm sm:text-base">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const totalSteps = 8;
const MIN_AI_LOADING_MS = 3500;

function RecommendationPage() {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<WizardSelections>(initialState);
  const [locationDestinations, setLocationDestinations] = useState<LocationDestination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadDestinations = async () => {
      try {
        const response = await fetch("/api/recommendations/locations");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { destinations?: LocationDestination[] };
        if (!mounted) return;
        setLocationDestinations(data.destinations ?? []);
      } catch {
        if (!mounted) return;
        setLocationDestinations([]);
      }
    };

    loadDestinations();

    return () => {
      mounted = false;
    };
  }, []);

  const availableDestinations = useMemo(
    () => (locationDestinations.length > 0 ? locationDestinations : []),
    [locationDestinations]
  );

  const cityOptions = useMemo(() => {
    return (
      availableDestinations.find((destination) => destination.countryCode === preferences.country)
        ?.cities ?? []
    );
  }, [preferences.country, availableDestinations]);

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(preferences.country);
    if (step === 2) return Boolean(preferences.city);
    if (step === 3) return preferences.tripType.length > 0;
    if (step === 4) return preferences.category.length > 0;
    if (step === 5) return preferences.amenity.length > 0;
    if (step === 6) return preferences.vibe.length > 0;
    if (step === 7) return preferences.guests > 0 && preferences.budget.max >= preferences.budget.min;
    return true;
  }, [step, preferences]);

  const selectedPreferenceItems = useMemo(() => {
    const items: string[] = [];

    if (preferences.country) items.push(preferences.country);
    if (preferences.city) items.push(preferences.city);
    items.push(...preferences.tripType);
    items.push(...preferences.category);
    items.push(...preferences.amenity);
    items.push(...preferences.vibe);

    return items;
  }, [preferences]);

  const handleSubmit = async () => {
    const startedAt = Date.now();
    setStep(totalSteps);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences: {
            country: preferences.country ? [preferences.country] : [],
            city: preferences.city ? [preferences.city] : [],
            tripType: preferences.tripType,
            preferredCategories: preferences.category,
            amenities: preferences.amenity,
            budget: preferences.budget,
            guests: preferences.guests,
            workFriendly:
              preferences.tripType.includes("workcation") ||
              preferences.vibe.includes("remote work friendly"),
            vibe: preferences.vibe,
          },
          fetchSize: 100,
          shortlistSize: 20,
          resultSize: 20,
        }),
      });

      const data = (await res.json()) as RecommendationResponse | { message?: string };
      if (!res.ok) {
        setError((data as { message?: string }).message || "Failed to get recommendations");
      } else {
        setResult(data as RecommendationResponse);
      }
    } catch {
      setError("Something went wrong while generating recommendations.");
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_AI_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_AI_LOADING_MS - elapsed));
      }
      setLoading(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto">
      <div className="rounded-2xl border bg-background p-6 sm:p-8 mb-8">
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl sm:text-3xl">Find Your Perfect Stay</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Start with where you are going, then refine by trip style, category, amenities, vibe, and budget.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-8 gap-2 mb-6">
              {Array.from({ length: totalSteps }, (_, index) => index + 1).map((item) => (
                <div
                  key={item}
                  className={`h-2 rounded-full transition-colors ${
                    step >= item ? "bg-primary" : "bg-primary/20"
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <DropdownField
                label="Where are you going right?"
                placeholder={availableDestinations.length > 0 ? "Select a country" : "No countries available"}
                value={preferences.country}
                options={availableDestinations.map((destination) => ({
                  value: destination.countryCode,
                  label: destination.countryName,
                }))}
                disabled={availableDestinations.length === 0}
                onValueChange={(value) =>
                  setPreferences((prev) => ({
                    ...prev,
                    country: value,
                    city: "",
                  }))
                }
              />
            )}

            {step === 2 && (
              <DropdownField
                label="Which city are you visiting?"
                placeholder={preferences.country ? "Select a city" : "Choose a country first"}
                value={preferences.city}
                options={cityOptions.map((city) => ({ value: city, label: city }))}
                disabled={!preferences.country}
                onValueChange={(value) => setPreferences((prev) => ({ ...prev, city: value }))}
              />
            )}

            {step === 3 && (
              <MultiSelectGrid
                title="What kind of trip is this?"
                subtitle="Pick up to 3 trip types"
                options={tripTypeOptions}
                selected={preferences.tripType}
                onToggle={(value) =>
                  setPreferences((prev) => {
                    const isSelected = prev.tripType.includes(value);
                    if (isSelected) {
                      return { ...prev, tripType: prev.tripType.filter((item) => item !== value) };
                    }

                    if (prev.tripType.length >= 3) {
                      return prev;
                    }

                    return { ...prev, tripType: [...prev.tripType, value] };
                  })
                }
              />
            )}

            {step === 4 && (
              <MultiSelectGrid
                title="Choose a stay category"
                subtitle="Pick up to 3 categories for focused ranking"
                options={categoryOptions}
                selected={preferences.category}
                onToggle={(value) =>
                  setPreferences((prev) => {
                    const isSelected = prev.category.includes(value);
                    if (isSelected) {
                      return { ...prev, category: prev.category.filter((item) => item !== value) };
                    }

                    if (prev.category.length >= 3) {
                      return prev;
                    }

                    return { ...prev, category: [...prev.category, value] };
                  })
                }
              />
            )}

            {step === 5 && (
              <MultiSelectGrid
                title="Most important amenity"
                subtitle="Choose up to 3 must-haves"
                options={amenityOptions}
                selected={preferences.amenity}
                onToggle={(value) =>
                  setPreferences((prev) => {
                    const isSelected = prev.amenity.includes(value);
                    if (isSelected) {
                      return { ...prev, amenity: prev.amenity.filter((item) => item !== value) };
                    }

                    if (prev.amenity.length >= 3) {
                      return prev;
                    }

                    return { ...prev, amenity: [...prev.amenity, value] };
                  })
                }
              />
            )}

            {step === 6 && (
              <MultiSelectGrid
                title="Preferred vibe"
                subtitle="Choose up to 3 moods"
                options={vibeOptions}
                selected={preferences.vibe}
                onToggle={(value) =>
                  setPreferences((prev) => {
                    const isSelected = prev.vibe.includes(value);
                    if (isSelected) {
                      return { ...prev, vibe: prev.vibe.filter((item) => item !== value) };
                    }

                    if (prev.vibe.length >= 3) {
                      return prev;
                    }

                    return { ...prev, vibe: [...prev.vibe, value] };
                  })
                }
              />
            )}

            {step === 7 && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-background/70">
                  <Label htmlFor="minBudget">Min Budget</Label>
                  <Input
                    id="minBudget"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={preferences.budget.min}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        budget: {
                          ...prev.budget,
                          min: Number(e.target.value.replace(/\D/g, "") || 0),
                        },
                      }))
                    }
                  />
                </div>

                <div className="rounded-xl  bg-background/70">
                  <Label htmlFor="maxBudget">Max Budget</Label>
                  <Input
                    id="maxBudget"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={preferences.budget.max}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        budget: {
                          ...prev.budget,
                          max: Number(e.target.value.replace(/\D/g, "") || 0),
                        },
                      }))
                    }
                  />
                </div>

                <div className="rounded-xl  bg-background/70">
                  <Label htmlFor="guests">Guests</Label>
                  <Input
                    id="guests"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={preferences.guests}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        guests: Math.max(1, Number(e.target.value.replace(/\D/g, "") || 1)),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {step === totalSteps && (
              <div className="py-1 sm:py-2">
                <p className="text-sm sm:text-base font-semibold">Recommendation results</p>
                {loading && (
                  <div className="mt-2 animate-pulse">
                    <p className="font-semibold text-sm sm:text-base">Finding best experience for you...</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      We are matching reviews, location, budget, and vibe preferences.
                    </p>
                  </div>
                )}
                {!loading && error && (
                  <p className="mt-2 text-xs sm:text-sm text-destructive font-medium">{error}</p>
                )}
                {!loading && !error && !result && (
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                    No recommendations yet. Go back and click Find Stays.
                  </p>
                )}
              </div>
            )}

            <Separator className="my-6" />

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                disabled={step === 1 || loading}
                className="rounded-full"
              >
                Back
              </Button>

              {step < totalSteps - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep((prev) => Math.min(totalSteps, prev + 1))}
                  disabled={!canContinue || loading}
                  className="rounded-full px-6"
                >
                  Continue
                </Button>
              ) : step === totalSteps - 1 ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canContinue || loading}
                  className="rounded-full px-6"
                >
                  Find Stays
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(totalSteps - 1)}
                  disabled={loading}
                  className="rounded-full px-6"
                >
                  Edit Preferences
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {step === totalSteps && !loading && result && (
        <section className="space-y-5">
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-semibold">AI Recommendations</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {result.summary.topMatchReason} · analyzed {result.summary.totalAnalyzed} properties
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {result.recommendations.map((item) => (
              <Card key={item.propertyId} className="overflow-hidden rounded-2xl border shadow-sm">
                {item.propertyImage ? (
                  <div className="relative w-full h-56">
                    <Image
                      src={item.propertyImage}
                      alt={item.propertyName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                      <p className="text-sm sm:text-base text-white font-semibold line-clamp-2">{item.propertyName}</p>
                      <span className="text-xs font-semibold rounded-full px-3 py-1 bg-white/90 text-black whitespace-nowrap">
                        {item.matchScore}% match
                      </span>
                    </div>
                  </div>
                ) : null}

                <CardContent className="space-y-3 pt-5">
                  {!item.propertyImage ? (
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-base sm:text-lg">{item.propertyName}</CardTitle>
                      <span className="text-xs font-semibold rounded-full px-3 py-1 bg-primary/15 text-primary">
                        {item.matchScore}% match
                      </span>
                    </div>
                  ) : null}

                  {(item.city || item.state) && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {item.city ? `${item.city}, ` : ""}
                      {item.state}
                    </p>
                  )}

                  <CardDescription className="text-xs sm:text-sm">{item.aiSummary}</CardDescription>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="font-medium mb-1">Why it matches</p>
                      <p className="text-muted-foreground">
                        {selectedPreferenceItems.join(" • ") || "No preferences selected"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="font-medium mb-1">Budget</p>
                      <p className="text-muted-foreground">{item.budgetFit.priceAssessment}</p>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm rounded-lg border p-3">
                    <p className="font-medium mb-1">Amenity match</p>
                    <p className="text-muted-foreground">
                      Matched: {item.amenityMatch.matched.join(", ") || "None"}
                    </p>
                    <p className="text-muted-foreground">
                      Missing: {item.amenityMatch.missing.join(", ") || "None"}
                    </p>
                  </div>

                  <Button asChild className="w-full rounded-full">
                    <Link href={`/properties/${item.propertyId}`}>View Property Details</Link>
                  </Button>
                  <SaveToCollectionButton
                    propertyId={item.propertyId}
                    propertyName={item.propertyName}
                    propertyImage={item.propertyImage ?? ""}
                    matchScore={item.matchScore}
                    country={item.state ?? ""}
                    city={item.city ?? ""}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export default RecommendationPage;
