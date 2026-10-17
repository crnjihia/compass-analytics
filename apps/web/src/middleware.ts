import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

const isMockDev =
  process.env.NODE_ENV !== 'production' ||
  !process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET_KEY.includes('mock');

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)', '/api/stream(.*)']);

const clerkHandler = clerkMiddleware(async (auth, req) => {
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

export default function middleware(req: NextRequest, event: any) {
  // In local development or demo mode with mock keys, completely bypass Clerk's middleware wrapper
  // to avoid redirecting the browser to non-existent mock Clerk domains like clerk.compass.dev
  if (isMockDev) {
    return NextResponse.next();
  }

  return clerkHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
