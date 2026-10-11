import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes: the landing page, Clerk's hosted-auth redirects, the health
// probe and the signature-verified Clerk webhook. Everything else requires a
// signed-in session (server-side enforced here, re-checked inside every
// page/handler — never trust the client).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/sso-callback(.*)",
  "/account-disabled",
  "/api/health",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId } = await auth();
  if (userId) return;

  // Explicit redirect (rather than auth.protect()) so the sign-in URL never
  // depends on Clerk's environment resolution — protect() 404s when it can't
  // resolve one, which hides real routes in deployments with partial env.
  const signIn = new URL("/sign-in", req.url);
  signIn.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(signIn);
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else + API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
