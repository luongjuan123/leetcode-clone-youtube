/**
 * One-time admin elevation script.
 * Uses Firebase Auth REST API to find the UID for dungpubgame@gmail.com
 * then writes isAdmin:true + role:"admin" to their Firestore document.
 *
 * Run with:  node scripts/make-admin.mjs
 */

const PROJECT_ID = "beastcode-7555e";
const API_KEY = "AIzaSyAacBT26QSRLqzbTvf_PzG5MOGYPZLy5yI";
const TARGET_EMAIL = "dungpubgame@gmail.com";

// ── Step 1: Get an anonymous ID token we can use to call the Admin lookup
//   (We use the "lookup by email" endpoint which requires an API key only)
async function getUidByEmail(email) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}`;
  // Instead use the accounts:lookup approach via signInWithPassword is wrong.
  // Use Admin SDK equivalent: accounts:lookup by email via the admin REST endpoint
  // This requires the Firebase Admin API which needs a service account.
  // Fallback: use the Firestore REST API to query by email field in the users collection.
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "email" },
          op: "EQUAL",
          value: { stringValue: email },
        },
      },
      limit: 1,
    },
  };

  const res = await fetch(firestoreUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log("Query response:", JSON.stringify(data, null, 2));

  if (!Array.isArray(data) || !data[0]?.document) {
    throw new Error(`No Firestore user document found for email: ${email}`);
  }

  // The document name looks like: projects/.../documents/users/{uid}
  const docName = data[0].document.name;
  const uid = docName.split("/").pop();
  return uid;
}

async function setAdmin(uid) {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=isAdmin&updateMask.fieldPaths=role`;

  const body = {
    fields: {
      isAdmin: { booleanValue: true },
      role: { stringValue: "admin" },
    },
  };

  const res = await fetch(docUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore PATCH failed: ${err}`);
  }

  const result = await res.json();
  console.log("\n✅ Admin elevation SUCCESS for UID:", uid);
  console.log("Updated fields:", JSON.stringify(result.fields?.isAdmin, null, 2));
}

async function main() {
  console.log(`🔍 Looking up Firestore document for: ${TARGET_EMAIL}`);
  try {
    const uid = await getUidByEmail(TARGET_EMAIL);
    console.log(`✓ Found UID: ${uid}`);
    await setAdmin(uid);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
