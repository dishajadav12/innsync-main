"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveToCollectionAction } from "@/utils/actions";
import { Button } from "@/components/ui/button";
import { FiBookmark } from "react-icons/fi";
import { ReloadIcon } from "@radix-ui/react-icons";
import type { actionFunction } from "@/utils/types";

type Props = {
  propertyId:    string;
  propertyName:  string;
  propertyImage: string;
  matchScore:    number;
  country:       string;
  city:          string;
};

function SubmitBtn({ message }: { message: string }) {
  const { pending } = useFormStatus();
  const saved        = message.startsWith("Saved");
  const alreadySaved = message.startsWith("Already");
  const active       = saved || alreadySaved;

  if (pending) {
    return (
      <Button type="submit" variant="outline" className="w-full mt-2" disabled>
        <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
        Saving...
      </Button>
    );
  }

  if (active) {
    return (
      <Button type="submit" variant="default" className="w-full mt-2" disabled>
        <FiBookmark className="mr-2 h-4 w-4 fill-current" />
        {alreadySaved ? "Already saved ✓" : "Saved ✓"}
      </Button>
    );
  }

  return (
    <Button type="submit" variant="outline" className="w-full mt-2">
      <FiBookmark className="mr-2 h-4 w-4" />
      Save to Collection
    </Button>
  );
}

export function SaveToCollectionButton(props: Props) {
  const boundAction = saveToCollectionAction.bind(null, props) as actionFunction;
  const [state, formAction] = useFormState(boundAction, { message: "" });

  return (
    <form action={formAction}>
      <SubmitBtn message={state.message} />
    </form>
  );
}
