#!/usr/bin/env node

console.log('🔧 Firebase Admin Setup\n');

const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Service account key found');
} else {
  console.log('⚠️  Service account key not found.');
  console.log('\nTo set up Firebase Admin SDK:');
  console.log('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.log('2. Click "Generate New Private Key"');
  console.log('3. Save as firebase-service-account.json in project root');
}

console.log('\n📝 Environment Setup:');
console.log('Make sure .env has NEXT_PUBLIC_FIREBASE_* variables set');

console.log('\n🔑 Next Steps:');
console.log('1. Set admin custom claim on your user (see ADMIN_SETUP.md)');
console.log('2. Update Firestore Security Rules');
console.log('3. Restart dev server');
console.log('4. Log out and back in\n');
