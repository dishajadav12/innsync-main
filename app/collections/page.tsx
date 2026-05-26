import Link from "next/link";
import Image from "next/image";
import { fetchUserCollections, fetchFavorites } from "@/utils/actions";
import { FaHeart } from "react-icons/fa";

async function CollectionsPage() {
  const [collections, favorites] = await Promise.all([
    fetchUserCollections(),
    fetchFavorites(),
  ]);

  const hasAnything = favorites.length > 0 || collections.length > 0;

  if (!hasAnything) {
    return (
      <section className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">My Collections</h1>
        <p className="text-muted-foreground">You haven&apos;t saved anything yet.</p>
        <Link href="/recommendations" className="text-primary underline text-sm">
          Get recommendations →
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-8">My Collections</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

        {/* ── Favorites collection card ── */}
        <Link href="/collections/favorites" className="group">
          <div className="rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
            <div className="relative h-36 bg-muted">
              {favorites[0] ? (
                <Image
                  src={favorites[0].image}
                  alt="Favorites"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <FaHeart className="text-muted-foreground w-8 h-8" />
                </div>
              )}
              {/* overlay grid of up to 3 more images */}
              {favorites.length > 1 && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
                  <div className="relative col-span-1 row-span-2">
                    <Image src={favorites[0].image} alt="" fill className="object-cover rounded-l" sizes="25vw" />
                  </div>
                  <div className="relative">
                    {favorites[1] && <Image src={favorites[1].image} alt="" fill className="object-cover rounded-tr" sizes="12vw" />}
                  </div>
                  <div className="relative">
                    {favorites[2] && <Image src={favorites[2].image} alt="" fill className="object-cover rounded-br" sizes="12vw" />}
                    {!favorites[2] && <div className="h-full bg-muted rounded-br" />}
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded-xl" />
            </div>
            <div className="px-3 py-2">
              <p className="font-semibold text-sm">Favorites</p>
              <p className="text-xs text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? "property" : "properties"}
              </p>
            </div>
          </div>
        </Link>

        {/* ── Saved recommendation collections ── */}
        {collections.map((collection) => {
          const cover = collection.items[0];
          const second = collection.items[1];
          const third = collection.items[2];
          return (
            <Link key={collection.id} href={`/collections/${collection.id}`} className="group">
              <div className="rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                <div className="relative h-36 bg-muted">
                  {cover ? (
                    collection.items.length > 1 ? (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
                        <div className="relative col-span-1 row-span-2">
                          <Image src={cover.propertyImage} alt="" fill className="object-cover rounded-l" sizes="25vw" />
                        </div>
                        <div className="relative">
                          {second && <Image src={second.propertyImage} alt="" fill className="object-cover rounded-tr" sizes="12vw" />}
                          {!second && <div className="h-full bg-muted rounded-tr" />}
                        </div>
                        <div className="relative">
                          {third && <Image src={third.propertyImage} alt="" fill className="object-cover rounded-br" sizes="12vw" />}
                          {!third && <div className="h-full bg-muted rounded-br" />}
                        </div>
                      </div>
                    ) : (
                      <Image src={cover.propertyImage} alt={collection.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Empty</div>
                  )}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded-xl" />
                </div>
                <div className="px-3 py-2">
                  <p className="font-semibold text-sm capitalize line-clamp-1">{collection.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {collection._count.items} {collection._count.items === 1 ? "property" : "properties"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}

      </div>
    </section>
  );
}

export default CollectionsPage;
