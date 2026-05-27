# Admin Access Setup Guide

This LeetCode clone now includes an admin system that allows designated admins to create, edit, and delete problems. Follow these steps to set up your admin account.

## Prerequisites
- Firebase project set up and running
- Admin SDK service account JSON file available

## Step 1: Enable Firebase Admin SDK (Recommended)

To properly verify admin status on the backend, you need to set up Firebase Admin SDK:

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Store it in your project root (or environment variables for production)

## Step 2: Make Yourself an Admin

### Option A: Using Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Authentication → Users**
4. Find your user email
5. Click the three dots menu → **Edit user**
6. Add a custom claim:
   - Key: `admin`
   - Value: `true`
7. Click **Save**

### Option B: Using Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase functions:config:set admin.emails="your-email@example.com"
```

## Step 3: Verify Admin Status

After setting the custom claim:

1. Log out of the application
2. Log back in
3. An **Admin** button should now appear in the top navigation bar
4. Click it to access the admin dashboard

## Step 4: Create Your First Problem

1. Go to `/admin` page (or click the Admin button)
2. Click **"+ Add Problem"** button
3. Fill in the problem details:
   - **Title**: Problem name
   - **Difficulty**: Easy, Medium, or Hard
   - **Category**: Topic/category name
   - **Description**: Full problem statement
   - **Examples**: Add at least one input/output example
   - **Order**: Position in the problem list
   - **YouTube Video ID**: (Optional) For tutorial video
   - **External Link**: (Optional) For additional resources
4. Click **Create Problem**

## API Endpoints

### POST `/api/admin/problems`
Create a new problem

**Requirements:**
- Authorization header with Bearer token
- User must have `admin: true` custom claim

**Request body:**
```json
{
  "title": "Two Sum",
  "difficulty": "Easy",
  "category": "Array",
  "description": "Given an array of integers...",
  "examples": [
    {
      "inputText": "[2,7,11,15], target = 9",
      "outputText": "[0,1]",
      "explanation": "Because nums[0] + nums[1] == 9"
    }
  ],
  "order": 1,
  "videoId": "abc123",
  "link": "https://example.com"
}
```

### DELETE `/api/admin/problems`
Delete a problem

**Request body:**
```json
{
  "id": "problem-id"
}
```

## Firestore Security Rules

Current rules allow:
- **Read**: All authenticated users can view problems
- **Write**: Only users with `admin: true` custom claim can create/update problems

To update rules:

1. Go to Firestore Database → Rules
2. Ensure rules match:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admins to manage problems
    match /problems/{document=**} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Other collections as needed
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish** to save

## Troubleshooting

### "Forbidden - Admin access required" error

- Ensure custom claim `admin: true` is set on your user
- Log out and log back in to refresh the token
- Clear browser cache if needed

### Admin button doesn't appear

- Custom claim might not be set correctly
- Wait a few seconds and refresh the page
- Check browser console for errors

### Problems don't save

- Check browser console for error messages
- Ensure you're logged in
- Verify Firestore security rules are correct
- Ensure all required fields are filled

## Making Other Users Admins

Repeat Step 2 for any additional admin users. Each user needs the `admin: true` custom claim set in Firebase Console.

## Revoking Admin Access

1. Go to Firebase Console → Authentication → Users
2. Find the user
3. Edit custom claims
4. Set `admin` to `false` or remove the claim
5. Click **Save**

## Security Notes

- Only set admin claims for trusted users
- Admin actions are logged in Firestore security rules
- Firestore rules enforce backend verification (don't rely on frontend only)
- Token refresh occurs every 60 minutes; new admins may need to re-authenticate

