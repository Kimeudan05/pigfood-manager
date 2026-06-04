import * as admin from "firebase-admin";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

export function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  if (!privateKey || !clientEmail) {
    throw new Error(
      "Firebase Admin SDK credentials are missing. Please define FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in your .env.local to enable full user deletion."
    );
  }

  // Handle newlines in the private key from .env
  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: formattedPrivateKey,
    }),
  });
}
export default getAdminApp;
