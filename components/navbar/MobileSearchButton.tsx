import Link from "next/link";
import { LuSearch } from "react-icons/lu";
import { Button } from "../ui/button";

function MobileSearchButton() {
  return (
    <Button asChild variant="outline" size="icon" className="md:hidden" aria-label="Open search">
      <Link href="/mobile-search">
        <LuSearch className="h-5 w-5" />
      </Link>
    </Button>
  );
}

export default MobileSearchButton;
