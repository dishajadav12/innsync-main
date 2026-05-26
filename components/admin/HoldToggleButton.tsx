"use client";
import { useFormStatus } from "react-dom";
import { togglePropertyHoldAction } from "@/utils/actions";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";

type Props = { propertyId: string; isOnHold: boolean };

function HoldSubmitButton({ isOnHold }: { isOnHold: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={isOnHold ? "default" : "outline"}
      size="sm"
      disabled={pending}
      className={isOnHold ? "bg-red-600 hover:bg-red-700 text-white" : ""}
    >
      {pending ? (
        <ReloadIcon className="h-3 w-3 animate-spin" />
      ) : isOnHold ? (
        "Remove Hold"
      ) : (
        "Put On Hold"
      )}
    </Button>
  );
}

export function HoldToggleButton({ propertyId, isOnHold }: Props) {
  const toggleWithId = togglePropertyHoldAction.bind(null, {
    propertyId,
    currentHoldStatus: isOnHold,
  });
  return (
    <form action={toggleWithId}>
      <HoldSubmitButton isOnHold={isOnHold} />
    </form>
  );
}
