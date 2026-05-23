"use client";

import { useTheme } from "next-themes";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

function ThemeMenuItems() {
  const { setTheme } = useTheme();

  return (
    <>
      <DropdownMenuSeparator className="md:hidden" />
      <DropdownMenuItem className="md:hidden" onClick={() => setTheme("light")}>Theme: Light</DropdownMenuItem>
      <DropdownMenuItem className="md:hidden" onClick={() => setTheme("dark")}>Theme: Dark</DropdownMenuItem>
      <DropdownMenuItem className="md:hidden" onClick={() => setTheme("system")}>Theme: System</DropdownMenuItem>
    </>
  );
}

export default ThemeMenuItems;
