import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Fast redirect to sign-in when there is no session cookie at all. This only
// checks that a cookie exists; pages and API handlers still verify the
// session and the user's clinic role on the server.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/receptionist/:path*",
    "/doctor/:path*",
    "/admin/:path*",
    "/super-admin/:path*",
  ],
};
