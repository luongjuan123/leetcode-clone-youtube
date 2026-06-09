/**
 * Firebase Admin SDK singleton initializer for Next.js API routes.
 * Uses Application Default Credentials (set by `firebase login --reauth`
 * or a GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account).
 */
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;

function getAdminApp(): App {
	if (!adminApp) {
		if (getApps().length === 0) {
			// Use ADC (Application Default Credentials):
			// works with `firebase login --reauth` or a GOOGLE_APPLICATION_CREDENTIALS file
			adminApp = initializeApp({
				projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
			});
		} else {
			adminApp = getApps()[0];
		}
	}
	return adminApp;
}

export function getAdminFirestore(): Firestore {
	if (!adminDb) {
		adminDb = getFirestore(getAdminApp());
	}
	return adminDb;
}

export function getAdminAuth(): Auth {
	if (!adminAuth) {
		adminAuth = getAuth(getAdminApp());
	}
	return adminAuth;
}
