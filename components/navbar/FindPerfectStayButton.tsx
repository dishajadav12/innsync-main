import Link from "next/link";
import { Button } from "../ui/button";

function FindPerfectStayButton() {
  return (
    <Button asChild className="font-semibold">
      <Link href="/recommendations">Find Your Perfect Stay</Link>
    </Button>
  );
}

export default FindPerfectStayButton;
