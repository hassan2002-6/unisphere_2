import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: the landing page, Clerk's hosted-auth redirects, the health
// probe and the signature-verified Clerk webhook. Everything else requires a
// signed-in session (server-side enforced here, re-checked inside every
// page/handler — never trust the client).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else + API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
