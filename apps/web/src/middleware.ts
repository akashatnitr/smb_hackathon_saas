import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth && (
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/clients") ||
    req.nextUrl.pathname.startsWith("/employees") ||
    req.nextUrl.pathname.startsWith("/boards") ||
    req.nextUrl.pathname.startsWith("/time-tracking") ||
    req.nextUrl.pathname.startsWith("/contracts") ||
    req.nextUrl.pathname.startsWith("/invoices") ||
    req.nextUrl.pathname.startsWith("/messages")
  )) {
    const newUrl = new URL("/auth/signin", req.nextUrl.origin);
    return NextResponse.redirect(newUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/employees/:path*",
    "/boards/:path*",
    "/time-tracking/:path*",
    "/contracts/:path*",
    "/invoices/:path*",
    "/messages/:path*",
  ],
};
