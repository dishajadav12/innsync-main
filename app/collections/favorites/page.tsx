import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFavorites } from "@/utils/actions";
import { LuArrowLeft, LuAlertTriangle } from "react-icons/lu";

async function FavoritesCollectionPage() {
  const favorites = await fetchFavorites();

  return (
    <section className="max-w-4xl mx-auto py-10">
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <LuArrowLeft className="w-4 h-4" />
        Collections
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Favorites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {favorites.length} {favorites.length === 1 ? "property" : "properties"}
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">No favorites yet.</p>
          <Link href="/" className="text-primary underline text-sm">
            Browse properties →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((property) => (
            <Card key={property.id} className="overflow-hidden rounded-xl border shadow-sm hover:shadow-md transition-shadow">
              <Link href={`/properties/${property.id}`}>
                <div className="relative h-44 w-full">
                  <Image
                    src={property.image}
                    alt={property.name}
                    fill
                    className={`object-cover ${property.isOnHold ? "opacity-60 grayscale-[30%]" : ""}`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {property.isOnHold && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-yellow-400/80 text-yellow-900 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                        Currently unavailable
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              {property.isOnHold && (
                <div className="flex items-start gap-2 px-3 pt-2.5 pb-1 bg-yellow-50/80 border-b border-yellow-100">
                  <LuAlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 leading-snug">
                    This property is temporarily on hold and may not be available for booking.
                  </p>
                </div>
              )}
              <CardContent className="p-3 space-y-1">
                <Link href={`/properties/${property.id}`}>
                  <p className="font-medium text-sm leading-snug hover:underline line-clamp-1">
                    {property.name}
                  </p>
                </Link>
                <p className="text-xs text-muted-foreground line-clamp-1">{property.tagline}</p>
                <p className="text-xs font-medium">${property.price} / night</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default FavoritesCollectionPage;
