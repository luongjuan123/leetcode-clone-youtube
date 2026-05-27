# Admin System - Quick Start

## What Was Added

✅ **Complete admin system** with the following features:

### 1. **Admin Authentication** (`src/hooks/useAdmin.ts`)
- Checks if user has `admin: true` custom claim
- Automatically refreshes token status
- Used throughout the app to protect admin features

### 2. **Admin Dashboard** (`src/pages/admin/index.tsx`)
- View all problems in a table
- Delete problems with confirmation
- Access problem management tools
- Protected route - redirects non-admins to home page

### 3. **Problem Creation Form** (`src/components/Modals/AddProblemModal.tsx`)
- Add new problems with:
  - Title, difficulty, category
  - Problem description
  - Multiple examples (input/output)
  - Constraints
  - Order (position in list)
  - YouTube video ID
  - External links
- Form validation before submission
- Success/error feedback

### 4. **API Endpoints** (`src/pages/api/admin/problems.ts`)
- `POST /api/admin/problems` - Create problems
- `DELETE /api/admin/problems` - Delete problems
- Backend verification using Firebase Admin SDK
- Token validation on every request

### 5. **UI Updates** (`src/components/Topbar/Topbar.tsx`)
- Admin link appears in navbar for admins only
- Links to `/admin` dashboard
- Conditionally shown based on user role

### 6. **Helper Utilities** (`src/utils/adminHelpers.ts`)
- Form validation functions
- Problem data transformation utilities

## Next Steps to Activate

### 1. Set Custom Claim in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. **Authentication → Users** 
4. Click your user email
5. **Edit user → Custom claims**
6. Add:
   ```json
   { "admin": true }
   ```
7. Click **Save**

### 2. Initialize Firebase Admin SDK (For API)

Option A: If using local development
- Download service account key from Firebase Console
- Place in project root or set environment variables

Option B: If using Firebase App Hosting
- Service account is automatically available

### 3. Update Firestore Security Rules

Go to **Firestore Database → Rules** and add:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /problems/{document=**} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

### 4. Test It Out

1. Log out and log back in (to refresh token)
2. You should see **Admin** button in top navbar
3. Click it to access admin dashboard
4. Click **+ Add Problem** to create your first problem

## File Structure

```
src/
├── hooks/
│   └── useAdmin.ts                      (NEW) Admin role hook
├── utils/
│   └── adminHelpers.ts                  (NEW) Validation utilities
├── pages/
│   ├── admin/
│   │   └── index.tsx                    (NEW) Admin dashboard
│   └── api/admin/
│       └── problems.ts                  (NEW) CRUD API endpoints
├── components/
│   ├── Topbar/Topbar.tsx                (MODIFIED) Added admin link
│   └── Modals/AddProblemModal.tsx        (NEW) Problem creation form
```

## Features Overview

| Feature | Status |
|---------|--------|
| Admin role checking | ✅ Complete |
| Admin dashboard | ✅ Complete |
| Problem creation form | ✅ Complete |
| Create problems via API | ✅ Complete |
| Delete problems | ✅ Complete |
| Conditional admin UI | ✅ Complete |
| Backend security | ✅ Complete |

## Troubleshooting

**Admin button not showing?**
- Make sure custom claim is set correctly in Firebase
- Log out and back in
- Check browser console for errors

**Can't create problems?**
- Verify Admin SDK is initialized
- Check that Firestore rules allow admin writes
- Ensure token has `admin: true` claim

**API returning 403?**
- Custom claim may not be set
- Token may have expired - try logging out/in
- Service account may not be configured

See `ADMIN_SETUP.md` for detailed setup instructions.
