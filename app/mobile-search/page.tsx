import Link from "next/link";
import { Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PropertiesContainer from "@/components/home/PropertiesContainer";
import LoadingCards from "@/components/card/LoadingCards";

function MobileSearchPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  return (
    <section>
      <div className="md:hidden space-y-5">
        <h1 className="text-2xl font-semibold">Search Stays</h1>
        <form action="/mobile-search" className="flex gap-2">
          <Input
            type="text"
            name="search"
            defaultValue={searchParams.search || ""}
            placeholder="Search properties..."
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>
        <Suspense fallback={<LoadingCards />}>
          <PropertiesContainer search={searchParams.search} />
        </Suspense>
      </div>

      <div className="hidden md:flex min-h-[40vh] items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-semibold">Mobile Search Page</h2>
          <p className="text-muted-foreground">This search page is designed for phone view only.</p>
          <Button asChild variant="outline">
            <Link href="/">Go Back Home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default MobileSearchPage;
