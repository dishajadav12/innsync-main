// import LoadingCards from "@/components/card/LoadingCards";
// import CategoriesList from "@/components/home/CategoriesList";
// import PropertiesContainer from "@/components/home/PropertiesContainer";
// import { Suspense } from "react";

// const HomePage = ({
//   searchParams,
// }: {
//   searchParams: { category?: string; search?: string };
// }) => {
//   return (
//     <section>
//       <CategoriesList
//         category={searchParams.category}
//         search={searchParams.search}
//       />
//       <Suspense fallback={<LoadingCards />}>
//         <PropertiesContainer
//           category={searchParams.category}
//           search={searchParams.search}
//         />
//       </Suspense>
//     </section>
//   );
// };
// export default HomePage;
import CategoriesList from "@/components/home/CategoriesList";
import PropertiesContainer from "@/components/home/PropertiesContainer";
import LoadingCards from "@/components/card/LoadingCards";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
function HomePage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string };
}) {
  return (
    <section>
      <div className="rounded-2xl border bg-card p-5 sm:p-7 mb-4 sm:mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">
              Let us give you the best stay
            </h1>
            <p className="text-xs sm:text-base text-muted-foreground max-w-2xl">
              Add your preference and find the best stay for your trip.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto text-sm sm:text-base">
            <Link href="/recommendations">Find Your Perfect Stay</Link>
          </Button>
        </div>
      </div>
      <CategoriesList
        category={searchParams?.category}
        search={searchParams?.search}
      />
      <Suspense fallback={<LoadingCards />}>
        <PropertiesContainer
          category={searchParams?.category}
          search={searchParams?.search}
        />
      </Suspense>
    </section>
  );
}
export default HomePage;
