import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)', '/api/stream(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isDashboardRoute(req)) {
    const session = await auth();

    // Reject unauthenticated users
    if (!session.userId) {
      return session.redirectToSignIn();
    }

    // Tenant isolation: SME owners must have an active organization selected
    if (!session.orgId) {
      const orgSelectionUrl = new URL('/org-selection', req.url);
      return NextResponse.redirect(orgSelectionUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
