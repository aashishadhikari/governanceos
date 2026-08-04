// EntityOS — Route protection proxy (Next.js 16+)
// Enforces Okta auth when AUTH_ENABLED=true. >> removed

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

//const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

function loginRedirectUrl(req: NextRequest, reason?: string) {
  const url = new URL('/login', req.url);
  url.searchParams.set('callbackUrl', req.nextUrl.pathname);
  if (reason) url.searchParams.set('error', reason);
  return url;
}

export async function proxy(req: NextRequest) {
  //if (!AUTH_ENABLED) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No session, or a token missing the userId claim it always gets on sign-in
  // (defensive — avoids an unguarded Prisma lookup with an undefined id).
  if (!token?.userId) {
    return NextResponse.redirect(loginRedirectUrl(req));
  }

  // Proxy runs on the Node.js runtime (Next.js 16+), so a direct DB check is
  // safe here. This catches a user deactivated mid-session on their very next
  // authenticated request, without polling.
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    const response = NextResponse.redirect(loginRedirectUrl(req, 'AccountDeactivated'));
    // Clear the stale session cookie so the invalidated JWT can't be reused.
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!login|setup-password|api/auth|api/setup-password|_next/static|_next/image|favicon.ico).*)',//removed 'public' from matcher which allow public folder access
  ],
};




