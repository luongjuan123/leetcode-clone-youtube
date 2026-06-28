/**
 * Firebase Admin SDK — singleton initializer for Next.js API routes.
 *
 * Authentication method: Service Account (cert) — NEVER ADC.
 *
 * Required environment variables:
 *   FIREBASE_PROJECT_ID     — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL   — Service account client_email
 *   FIREBASE_PRIVATE_KEY    — Service account private_key (newlines as \n)
 *
 * These must be set in .env.local (dev) and the hosting environment (production).
 * The application will throw a hard startup error if any variable is missing.
 */

import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

// ─── Startup Validation ───────────────────────────────────────────────────────
// Runs at module import time (cold start / first request) so misconfiguration
// surfaces immediately, not buried in a runtime error during a real user action.
function assertEnvVar(name: string): string {
	const value = process.env[name];
	if (!value || value.trim() === "") {
		const msg =
			`[Firebase Admin] FATAL: Required environment variable "${name}" is missing or empty.\n` +
			`Add it to .env.local (development) or your hosting environment (production).\n` +
			`See: https://firebase.google.com/docs/admin/setup#initialize-sdk`;
		console.error(msg);
		// Throw so Next.js logs the error clearly at startup, not silently at runtime.
		throw new Error(msg);
	}
	return value;
}

// ─── Singleton App ────────────────────────────────────────────────────────────
function getAdminApp(): App {
	// Return existing app if already initialized (hot-reload / module cache)
	if (getApps().length > 0) {
		return getApp();
	}

	// Validate all required credentials before touching Firebase
	const projectId    = assertEnvVar("FIREBASE_PROJECT_ID");
	const clientEmail  = assertEnvVar("FIREBASE_CLIENT_EMAIL");
	// Private keys stored in .env files encode newlines as literal \n — decode them.
	const privateKey   = assertEnvVar("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

	return initializeApp({
		credential: cert({ projectId, clientEmail, privateKey }),
	});
}

// ─── Public Accessors (lazy singleton) ────────────────────────────────────────
let _db: Firestore | null = null;
let _auth: Auth | null = null;

export function getAdminFirestore(): Firestore {
	if (!_db) {
		_db = getFirestore(getAdminApp());
	}
	return _db;
}

export function getAdminAuth(): Auth {
	if (!_auth) {
		_auth = getAuth(getAdminApp());
	}
	return _auth;
}
