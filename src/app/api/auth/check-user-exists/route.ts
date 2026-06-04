import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    let app;
    try {
      app = getAdminApp();
    } catch (configError: any) {
      // Return a 503 Service Unavailable or 500 to signal that the Admin SDK is not configured
      return NextResponse.json(
        { error: "Admin SDK not configured: " + configError.message },
        { status: 503 }
      );
    }

    const adminAuth = admin.auth(app);

    try {
      // Check if user exists in Firebase Authentication
      await adminAuth.getUserByEmail(email.toLowerCase().trim());
      return NextResponse.json({ exists: true });
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        return NextResponse.json({ exists: false });
      }
      console.error("Auth lookup error:", authError);
      throw authError;
    }
  } catch (error: any) {
    console.error("Error in check-user-exists endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check if user exists" },
      { status: 500 }
    );
  }
}
