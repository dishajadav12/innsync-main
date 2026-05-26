"use client";
import { useOptimistic, useTransition } from "react";
import { togglePropertyHoldAction } from "@/utils/actions";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";

type Props = { propertyId: string; isOnHold: boolean };

export function HoldToggleButton({ propertyId, isOnHold }: Props) {
  const [optimisticHold, setOptimisticHold] = useOptimistic(isOnHold);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setOptimisticHold(!optimisticHold);
      await togglePropertyHoldAction({
        propertyId,
        currentHoldStatus: optimisticHold,
      });
    });
  };

  return (
    <Button
      type="button"
      variant={optimisticHold ? "default" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={handleSubmit}
      className={optimisticHold ? "bg-red-600 hover:bg-red-700 text-white" : ""}
    >
      {isPending ? (
        <ReloadIcon className="h-3 w-3 animate-spin" />
      ) : optimisticHold ? (
        "Remove Hold"
      ) : (
        "Put On Hold"
      )}
    </Button>
  );
}

