# Firebase Configuration Guide

To ensure your app works perfectly and data is secure (so only Admin can change content, but Students can save their progress), you must set up **Firebase Security Rules**.

## 1. Realtime Database Rules
Go to **Firebase Console** -> **Build** -> **Realtime Database** -> **Rules**.
Paste this:

```json
{
  "rules": {
    "users": {
      "$uid": {
        // Users can read/write their own data
        // Admins and Sub-Admins can read/write all user data
        ".read": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'ADMIN' || root.child('users').child(auth.uid).child('role').val() === 'SUB_ADMIN'",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'ADMIN' || root.child('users').child(auth.uid).child('role').val() === 'SUB_ADMIN'"
      }
    },
    "content_data": {
      // Only Admin can write content, everyone can read
      ".read": true,
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    "redeem_codes": {
      // Admin writes, Users can read to check validity and write to mark redeemed
      ".read": true,
      ".write": true
    },
    "system_settings": {
      ".read": true,
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    "content_links": {
      ".read": true,
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    "recovery_requests": {
      ".read": "root.child('users').child(auth.uid).child('role').val() === 'ADMIN' || root.child('users').child(auth.uid).child('role').val() === 'SUB_ADMIN'",
      ".write": true
    },
    "universal_updates": {
      ".read": true,
      ".write": "root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    }
  }
}
```

## 2. Firestore Rules (Cloud Firestore)
Go to **Firebase Console** -> **Build** -> **Firestore Database** -> **Rules**.
Paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is Admin or Sub-Admin
    function isAdminOrSubAdmin() {
      return request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN' ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SUB_ADMIN'
      );
    }

    function isAdmin() {
      return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN';
    }

    // User Profiles
    // Users see their own; Admins/Sub-Admins see everyone
    match /users/{userId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || isAdminOrSubAdmin());
    }
    
    // Content Data (Chapters, Links)
    match /content_data/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Redeem Codes
    match /redeem_codes/{code} {
      allow read, write: if true; // Needs to be writable by users to mark as redeemed
    }
    
    // Config
    match /config/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

## 3. Storage Rules (If you use Storage for PDFs)
Go to **Storage** -> **Rules**.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // Or restrict write to Admin
    }
  }
}
```

## Important Note
After pasting these rules, click **Publish**. This ensures your "Admin jo badle student ko dikhe" (Admin updates are visible) and "data save ho jaye" (Persistence) works securely.
