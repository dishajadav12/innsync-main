import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LuAlignLeft,
  LuHome,
  LuBookmark,
  LuCalendar,
  LuStar,
  LuCalendarCheck,
  LuPlusCircle,
  LuBuilding2,
  LuSettings,
  LuUser,
  LuLogIn,
  LuUserPlus,
  LuLogOut,
} from "react-icons/lu";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import UserIcon from "./UserIcon";
import { links } from "@/utils/links";
import SignOutLink from "./SignOutLink";
import { SignedOut, SignedIn, SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import ThemeMenuItems from "./ThemeMenuItems";

// Icon for each nav link label defined in utils/links.ts
const LINK_ICONS: Record<string, ReactNode> = {
  home:            <LuHome className="h-4 w-4" />,
  collections:     <LuBookmark className="h-4 w-4" />,
  bookings:        <LuCalendar className="h-4 w-4" />,
  reviews:         <LuStar className="h-4 w-4" />,
  reservations:    <LuCalendarCheck className="h-4 w-4" />,
  "create rental": <LuPlusCircle className="h-4 w-4" />,
  "my rentals":    <LuBuilding2 className="h-4 w-4" />,
  admin:           <LuSettings className="h-4 w-4" />,
  profile:         <LuUser className="h-4 w-4" />,
};

// Shared row style used for every item in the sheet
const rowCls =
  "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors text-left";

function LinksDropdown() {
  const { userId } = auth();
  const isAdminUser = userId === process.env.ADMIN_USER_ID;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex gap-4 max-w-[100px]">
          <LuAlignLeft className="w-6 h-6" />
          <UserIcon />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-72 flex flex-col gap-0 p-0 pt-10">
        <SheetHeader className="px-5 pb-3 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
          {/* ── Signed-out: login / register ── */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className={rowCls}>
                <LuLogIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                Login
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button className={rowCls}>
                <LuUserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                Register
              </button>
            </SignUpButton>

            <div className="my-2 border-t" />
          </SignedOut>

          {/* ── Signed-in: nav links + logout ── */}
          <SignedIn>
            {links.map((link) => {
              if (link.label === "admin" && !isAdminUser) return null;
              const label = link.label.trim();
              const href  = link.href.trim();
              return (
                <SheetClose asChild key={href}>
                  <Link href={href} className={`${rowCls} capitalize`}>
                    <span className="shrink-0 text-muted-foreground">
                      {LINK_ICONS[label] ?? <LuUser className="h-4 w-4" />}
                    </span>
                    {label}
                  </Link>
                </SheetClose>
              );
            })}

            <div className="my-2 border-t" />

            {/* Logout row — icon sits outside SignOutLink to keep that component unchanged */}
            <div className={rowCls}>
              <LuLogOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SignOutLink />
            </div>
          </SignedIn>

          {/* ── Theme switcher (mobile only, md:hidden inside ThemeMenuItems) ── */}
          <ThemeMenuItems />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export default LinksDropdown;
