# Admin Access Setup Checklist

Use this checklist to ensure you complete all required setup steps.

## Phase 1: Firebase Configuration

- [ ] **1.1 Set Custom Claim in Firebase Console**
  - [ ] Go to Firebase Console → Select your project
  - [ ] Navigate to Authentication → Users
  - [ ] Find and click your user email
  - [ ] Click the "Edit user" menu (three dots)
  - [ ] Scroll to "Custom claims"
  - [ ] Enter JSON: `{ "admin": true }`
  - [ ] Click Save

- [ ] **1.2 Download Service Account Key**
  - [ ] Go to Firebase Console → Project Settings
  - [ ] Click "Service Accounts" tab
  - [ ] Click "Generate New Private Key"
  - [ ] Save the JSON file securely

- [ ] **1.3 Place Service Account Key**
  - [ ] Copy the JSON file to project root
  - [ ] Rename it to `firebase-service-account.json`
  - [ ] Add to `.gitignore` (DO NOT commit!)

## Phase 2: Application Configuration

- [ ] **2.1 Verify Files Are Present**
  - [ ] `src/hooks/useAdmin.ts` exists
  - [ ] `src/pages/admin/index.tsx` exists
  - [ ] `src/pages/api/admin/problems.ts` exists
  - [ ] `src/components/Modals/AddProblemModal.tsx` exists

- [ ] **2.2 Check Configuration Files**
  - [ ] Environment variables are set (.env or .env.local)
  - [ ] `NEXT_PUBLIC_FIREBASE_*` variables configured
  - [ ] Service account key in project root or env vars

## Phase 3: Firestore Setup

- [ ] **3.1 Update Firestore Security Rules**
  - [ ] Go to Firestore Database → Rules
  - [ ] Copy rules from ADMIN_SETUP.md
  - [ ] Replace existing rules
  - [ ] Click "Publish"
  - [ ] Rules update successfully

## Phase 4: Testing

- [ ] **4.1 Start Development Server**
  - [ ] Run `npm run dev`
  - [ ] No build errors
  - [ ] Server runs on http://localhost:3000

- [ ] **4.2 Test Admin Access**
  - [ ] Log out of application
  - [ ] Log back in with your user
  - [ ] "Admin" button appears in navbar
  - [ ] Click "Admin" button
  - [ ] Admin dashboard loads at /admin
  - [ ] Can see "Add Problem" button

- [ ] **4.3 Test Problem Creation**
  - [ ] Click "+ Add Problem" button
  - [ ] Form modal appears
  - [ ] Fill in all required fields
  - [ ] Add at least one example
  - [ ] Click "Create Problem"
  - [ ] Success message appears
  - [ ] Problem appears in table

- [ ] **4.4 Test Problem Deletion**
  - [ ] Click "Delete" button on a problem
  - [ ] Confirm deletion when prompted
  - [ ] Problem removed from table

## Phase 5: Verification

- [ ] **5.1 Frontend Features**
  - [ ] Admin link appears in navbar (when logged in as admin)
  - [ ] Admin link redirects to /admin
  - [ ] Dashboard loads without errors
  - [ ] Problem list displays all problems
  - [ ] Add Problem modal works

- [ ] **5.2 Backend Features**
  - [ ] API accepts POST requests to create problems
  - [ ] API accepts DELETE requests
  - [ ] Token verification works
  - [ ] Non-admins get 403 error
  - [ ] Server logs show no errors

- [ ] **5.3 Database Features**
  - [ ] Problems save to Firestore
  - [ ] Problems appear in Firebase Console
  - [ ] Only admins can create/delete
  - [ ] Regular users can read problems

## Phase 6: Security Verification

- [ ] **6.1 Access Control**
  - [ ] Non-admin users cannot access /admin
  - [ ] Non-admin users don't see Admin button
  - [ ] Non-admin users get redirected from /admin

- [ ] **6.2 API Security**
  - [ ] API rejects requests without token
  - [ ] API rejects requests without admin claim
  - [ ] API rejects invalid tokens
  - [ ] Backend logs show verification attempts

## Phase 7: Documentation

- [ ] **7.1 Read Documentation**
  - [ ] Read QUICK_START.md
  - [ ] Read ADMIN_SETUP.md
  - [ ] Read ADMIN_IMPLEMENTATION_INDEX.md

- [ ] **7.2 Understand System**
  - [ ] Know how admin access works
  - [ ] Know how to add more admins
  - [ ] Know troubleshooting steps

## Troubleshooting Checklist

If something doesn't work:

- [ ] **Admin button not showing?**
  - [ ] Verify custom claim is set to true (not "true" string)
  - [ ] Log out and log back in
  - [ ] Check browser console for errors
  - [ ] Clear browser cache
  - [ ] Check Firebase Console to confirm claim exists

- [ ] **Can't create problems?**
  - [ ] Check browser console for errors
  - [ ] Verify service account key is in place
  - [ ] Check Firestore rules allow admin writes
  - [ ] Ensure all form fields are filled
  - [ ] Check server console for errors

- [ ] **Getting 403/401 errors?**
  - [ ] Log out and back in to refresh token
  - [ ] Verify custom claim exists in Firebase
  - [ ] Check token verification in server logs
  - [ ] Verify Bearer token is being sent

- [ ] **Firestore rules not working?**
  - [ ] Make sure rules are published (green check)
  - [ ] Verify syntax is correct
  - [ ] Check rules don't have syntax errors
  - [ ] Try reloading the page

## Success Indicators

✅ You're done when:
- [ ] "Admin" button appears in navbar
- [ ] Can access /admin dashboard
- [ ] Can create problems successfully
- [ ] Problems appear in Firestore
- [ ] Can delete problems
- [ ] No console errors
- [ ] No API errors

---

**Once all items are checked, you have successfully set up the admin system!** 🎉

For any issues, refer to:
1. ADMIN_SETUP.md - Troubleshooting section
2. Browser console (F12 → Console tab)
3. Server logs (terminal running npm run dev)
