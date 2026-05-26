import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import FormContainer from "@/components/form/FormContainer";
import { SubmitButton } from "@/components/form/Buttons";
import { fetchUserCollections, removeFromCollectionAction } from "@/utils/actions";
import { LuArrowLeft, LuAlertTriangle } from "react-icons/lu";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function RemoveItemForm({ itemId }: { itemId: string }) {
  const action = removeFromCollectionAction.bind(null, { itemId });
  return (
    <FormContainer action={action}>
      <SubmitButton text="Remove" size="sm" variant="outline" className="mt-1" />
    </FormContainer>
  );
}

async function CollectionDetailPage({ params }: { params: { id: string } }) {
  const collections = await fetchUserCollections();
  const collection = collections.find((c) => c.id === params.id);

  if (!collection) notFound();

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
          <h1 className="text-2xl font-bold capitalize">{collection.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {collection._count.items} {collection._count.items === 1 ? "property" : "properties"}
          </p>
        </div>
      </div>

      {collection.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">This collection is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {collection.items.map((item) => (
            <Card key={item.id} className="overflow-hidden rounded-xl border shadow-sm hover:shadow-md transition-shadow">
              <Link href={`/properties/${item.propertyId}`}>
                <div className="relative h-44 w-full">
                  <Image
                    src={item.propertyImage}
                    alt={item.propertyName}
                    fill
                    className={`object-cover ${item.isOnHold ? "opacity-60 grayscale-[30%]" : ""}`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {item.matchScore != null && !item.isOnHold && (
                    <span className="absolute top-2 right-2 text-xs font-semibold rounded-full px-2.5 py-0.5 bg-white/90 text-black shadow-sm">
                      {item.matchScore}% match
                    </span>
                  )}
                  {item.isOnHold && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-yellow-400/80 text-yellow-900 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                        Currently unavailable
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              {item.isOnHold && (
                <div className="flex items-start gap-2 px-3 pt-2.5 pb-1 bg-yellow-50/80 border-b border-yellow-100">
                  <LuAlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 leading-snug">
                    This property is temporarily on hold and may not be available for booking.
                  </p>
                </div>
              )}
              <CardContent className="p-3 space-y-1">
                <Link href={`/properties/${item.propertyId}`}>
                  <p className="font-medium text-sm leading-snug hover:underline line-clamp-1">
                    {item.propertyName}
                  </p>
                </Link>
                <p className="text-xs text-muted-foreground">
                  Saved {timeAgo(item.addedAt)}
                </p>
                <RemoveItemForm itemId={item.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default CollectionDetailPage;
