import { NextResponse } from "next/server";

/**
 * DEV-ONLY: Returns the current auth state for debugging.
 * In development, Clerk's keyless mode auto-signs in the first user.
 * This endpoint redirects to the Clerk sign-in page with a special flow.
 *
 * REMOVE BEFORE PRODUCTION.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  // Redirect to Clerk's dev sign-in which auto-creates a dev user
  return NextResponse.redirect(
    new URL("/sign-in#/factor-one", "http://localhost:3000")
  );
}
