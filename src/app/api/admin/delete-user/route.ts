import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

export async function POST(request: Request) {
  try {
    // 1. Initialize Firebase Admin SDK
    let app;
    try {
      app = getAdminApp();
    } catch (configError: any) {
      return NextResponse.json(
        { error: configError.message },
        { status: 500 }
      );
    }

    const adminAuth = admin.auth(app);
    const adminDb = admin.firestore(app);

    // 2. Validate Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized. Missing token." }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];

    // 3. Decode token to get caller uid
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (tokenError: any) {
      return NextResponse.json({ error: "Unauthorized. Invalid token." }, { status: 401 });
    }
    const callerUid = decodedToken.uid;

    // 4. Verify caller's role in Firestore
    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: "Access denied. User profile not found." }, { status: 403 });
    }

    const callerRole = callerDoc.data()?.role;
    if (callerRole !== "admin" && callerRole !== "owner") {
      return NextResponse.json({ error: "Access denied. Admin or Owner role required." }, { status: 403 });
    }

    // 5. Parse request body for target UID to delete
    const body = await request.json();
    const { uid } = body;
    if (!uid) {
      return NextResponse.json({ error: "Missing target user ID (uid)." }, { status: 400 });
    }

    if (uid === callerUid) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    // Verify target user's role to prevent admin deleting owner
    const targetDoc = await adminDb.collection("users").doc(uid).get();
    if (targetDoc.exists) {
      const targetRole = targetDoc.data()?.role;
      if (targetRole === "owner" && callerRole !== "owner") {
        return NextResponse.json({ error: "Access denied. Admins cannot delete the owner." }, { status: 403 });
      }
    }

    // 6. Delete user from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError: any) {
      // If user is already deleted or doesn't exist in Auth, we can still proceed to clean up Firestore
      if (authError.code !== "auth/user-not-found") {
        console.error("Firebase Auth deletion error:", authError);
        throw authError;
      }
    }

    // 7. Delete user document from Firestore users collection
    await adminDb.collection("users").doc(uid).delete();

    return NextResponse.json({ success: true, message: "User deleted successfully from Auth and Firestore." });
  } catch (error: any) {
    console.error("Error in delete-user endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
