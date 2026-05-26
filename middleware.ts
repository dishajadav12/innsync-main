import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/properties(.*)",
  "/recommendations(.*)",
  "/api/recommendations(.*)",
  "/api/health/db",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
export default clerkMiddleware((auth, req) => {
  const { userId } = auth();
  const isAdminUser = userId === process.env.ADMIN_USER_ID;
  if (isAdminRoute(req) && !isAdminUser) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!isPublicRoute(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
