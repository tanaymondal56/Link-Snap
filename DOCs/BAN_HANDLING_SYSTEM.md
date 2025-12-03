# Ban Handling System Documentation

## Overview

The Link Snap ban handling system provides comprehensive user moderation capabilities, allowing administrators to suspend user accounts with immediate effect. This document outlines all features, scenarios, and system behaviors related to user banning.

---

## Table of Contents

1. [Features](#features)
2. [User Model Schema](#user-model-schema)
3. [Admin Actions](#admin-actions)
4. [System Behaviors](#system-behaviors)
5. [Scenarios & Responses](#scenarios--responses)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Security Considerations](#security-considerations)

---

## Features

### Core Features

| Feature                          | Description                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| **Immediate Account Suspension** | User loses access instantly upon ban                           |
| **Token Invalidation**           | All refresh tokens are cleared immediately                     |
| **Ban Reason**                   | Admins can provide a reason for the ban (up to 500 characters) |
| **Per-User Link Control**        | Configure whether banned user's links continue working         |
| **Ban Timestamp**                | System records when the user was banned                        |
| **Detailed Suspended Page**      | Users see comprehensive info when banned                       |
| **Support Contact Info**         | Banned users receive contact details for appeals               |
| **Email Notifications**          | Users receive emails when banned or unbanned                   |
| **Appeal System**                | Secure in-app appeal submission with 3-strike limit            |

### Per-User Link Disable Option

When banning a user, admins can choose:

- **Disable Links (Default: ON)** - All short links created by the user stop redirecting
- **Keep Links Active** - Links continue to work even though user is banned

This allows flexibility for cases where:

- Links are embedded in important external content
- The ban is for account misuse, not link abuse
- Temporary suspension where links should remain functional

---

## User Model Schema

```javascript
{
  isActive: {
    type: Boolean,
    default: true  // false = banned
  },
  disableLinksOnBan: {
    type: Boolean,
    default: true  // When banned, links are disabled by default
  },
  bannedAt: {
    type: Date,
    default: null  // Timestamp when user was banned
  },
  bannedReason: {
    type: String,
    maxlength: 500,
    default: null  // Admin-provided reason
  },
  refreshTokens: [{
    type: String   // Cleared on ban for immediate logout
  }]
}
```

---

## Admin Actions

### Banning a User

1. Admin clicks the **Ban** button on a user row
2. **Ban User Modal** opens with:
   - User's email and name displayed
   - Warning about immediate effect
   - Optional reason textarea (500 char limit)
   - Toggle for "Disable User's Links" (default: ON)
3. Admin clicks **Ban User**
4. System immediately:
   - Sets `isActive = false`
   - Sets `bannedAt = new Date()`
   - Sets `bannedReason` (if provided)
   - Sets `disableLinksOnBan` based on toggle
   - Clears all `refreshTokens`
   - Invalidates cache for all user's links (shortId AND customAlias)

### Activating (Unbanning) a User

1. Admin clicks the **Activate** button on a banned user
2. **Unban User Modal** opens with:
   - User's email and name displayed
   - Info message about restoring access
   - Toggle for "Re-enable User's Links" (default: ON, only shown if user had links disabled)
   - Warning if choosing not to re-enable links
3. Admin clicks **Activate User**
4. System immediately:
   - Sets `isActive = true`
   - Clears `bannedAt` (set to undefined)
   - Clears `bannedReason` (set to undefined)
   - If `reenableLinks` is true, sets `disableLinksOnBan = false`
   - Invalidates cache for all user's links (shortId AND customAlias)

**Note:** If admin chooses not to re-enable links during unban, `disableLinksOnBan` remains `true` and links stay disabled until manually changed.

---

## System Behaviors

### Authentication Layer

| Event                              | System Response                                           |
| ---------------------------------- | --------------------------------------------------------- |
| Banned user attempts login         | Returns 403 with ban details, redirects to suspended page |
| Banned user's access token expires | Refresh token rejected, session terminated                |
| Banned user has active session     | Next API call returns 403, immediate logout               |

### Token Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN INVALIDATION FLOW                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Admin Bans User                                             │
│        │                                                     │
│        ▼                                                     │
│  Clear all refreshTokens from database                       │
│        │                                                     │
│        ▼                                                     │
│  User's next API request:                                    │
│        │                                                     │
│        ├──► Access Token Valid?                              │
│        │         │                                           │
│        │         ├── YES ──► Check isActive                  │
│        │         │              │                            │
│        │         │              └── FALSE ──► 403 Banned     │
│        │         │                                           │
│        │         └── NO ──► Try Refresh                      │
│        │                        │                            │
│        │                        └── Token not in DB ──► 401  │
│        │                                                     │
│        └──► User logged out immediately                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Link Redirect Behavior

```
┌─────────────────────────────────────────────────────────────┐
│                    LINK REDIRECT FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Visitor clicks short link                                   │
│        │                                                     │
│        ▼                                                     │
│  Is link active? ──── NO ────► Show "Link Unavailable" page  │
│        │                                                     │
│       YES                                                    │
│        │                                                     │
│        ▼                                                     │
│  Does link have an owner (createdBy)?                        │
│        │                                                     │
│        ├── NO ──► Redirect to destination (anonymous link)   │
│        │                                                     │
│       YES                                                    │
│        │                                                     │
│        ▼                                                     │
│  Is owner banned (isActive = false)?                         │
│        │                                                     │
│        ├── NO ──► Redirect to destination                    │
│        │                                                     │
│       YES                                                    │
│        │                                                     │
│        ▼                                                     │
│  Is owner's disableLinksOnBan = true?                        │
│        │                                                     │
│        ├── NO ──► Redirect to destination (links kept)       │
│        │                                                     │
│       YES                                                    │
│        │                                                     │
│        ▼                                                     │
│  Show "Link Unavailable" page (410 Gone)                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Appeal System Workflow

The appeal system allows banned users to request a review of their suspension.

1.  **Secure Access**: Banned users receive a specific `appealToken` upon failed login. This token authorizes them _only_ to submit appeals.
2.  **Submission Limits**:
    - Users are limited to **3 appeals** per ban session.
    - The counter is tied to the `bannedAt` timestamp.
    - If a user is unbanned and re-banned, the counter resets.
3.  **Admin Review**:
    - Admins see a queue of pending appeals.
    - **Reject**: Increments the user's appeal count. If count reaches 3, the user is blocked from further appeals.
    - **Unban**: Restores access immediately.
    - **Unban Pending**: Marks the appeal as approved but keeps the user banned (e.g., for probation or manual review).

---

## Scenarios & Responses

### Scenario 1: Banned User Tries to Login

**Trigger:** User enters correct email and password at login

**System Response:**

1. Password verification succeeds
2. System checks `isActive` field
3. Returns 403 response with:
   ```json
   {
     "message": "Your account has been suspended.",
     "banned": true,
     "bannedReason": "Violation of terms of service",
     "bannedAt": "2025-12-02T10:30:00.000Z",
     "support": {
       "email": "support@linksnap.com",
       "message": "If you believe this is a mistake, please contact our support team."
     }
   }
   ```
4. Frontend stores ban info in sessionStorage
5. Redirects to `/account-suspended` page
6. Suspended page displays:
   - Ban notification
   - Reason (if provided)
   - Support contact information
   - Instructions for appeal

---

### Scenario 2: Active User Gets Banned While Logged In

**Trigger:** Admin bans a user who currently has an active session

**System Response:**

1. All refresh tokens cleared from database immediately
2. User continues until access token expires (typically 15 minutes)
3. On next API call after expiry:
   - Frontend attempts token refresh
   - Refresh fails (token not in database)
   - Or authMiddleware checks `isActive` and returns 403
4. Axios interceptor detects 403 with `banned: true`
5. Clears localStorage (tokens, user data)
6. Stores ban message in sessionStorage
7. Redirects to `/account-suspended`

**Timeline:**

```
T+0:00  - Admin clicks "Ban User"
T+0:00  - Refresh tokens cleared from DB
T+0:01  - User makes API call (access token still valid) - WORKS
T+15:00 - Access token expires
T+15:01 - User makes API call
        - Access token invalid
        - Refresh attempted
        - Refresh fails (403 banned)
        - User redirected to suspended page
```

---

### Scenario 3: Banned User's Links (Links Disabled)

**Trigger:** Visitor clicks a short link owned by a banned user with `disableLinksOnBan = true`

**System Response:**

1. System looks up URL by shortId
2. Finds the URL and checks `createdBy` field
3. Fetches owner and checks:
   - `owner.isActive === false` (banned)
   - `owner.disableLinksOnBan === true`
4. Returns 410 Gone status
5. Shows "Link Unavailable" page with:
   - Error icon
   - Message that link is no longer available
   - Link to Link Snap homepage

---

### Scenario 4: Banned User's Links (Links Kept Active)

**Trigger:** Visitor clicks a short link owned by a banned user with `disableLinksOnBan = false`

**System Response:**

1. System looks up URL by shortId
2. Finds the URL and checks `createdBy` field
3. Fetches owner and checks:
   - `owner.isActive === false` (banned)
   - `owner.disableLinksOnBan === false`
4. Link continues to work normally
5. Redirects visitor to destination
6. Analytics still recorded

---

### Scenario 5: Admin Activates (Unbans) a User with Link Re-enable

**Trigger:** Admin clicks "Activate" on a banned user and chooses to re-enable links

**System Response:**

1. Unban User Modal shown with re-enable links toggle
2. Admin keeps "Re-enable User's Links" toggle ON (default)
3. Admin clicks "Activate User"
4. System updates user:
   - `isActive = true`
   - `bannedAt = undefined`
   - `bannedReason = undefined`
   - `disableLinksOnBan = false` (links re-enabled)
5. Cache invalidated for all user's links (shortId AND customAlias)
6. User can now:
   - Login normally
   - Access their dashboard
   - All their links work immediately

---

### Scenario 5b: Admin Activates User WITHOUT Link Re-enable

**Trigger:** Admin clicks "Activate" on a banned user but chooses NOT to re-enable links

**System Response:**

1. Unban User Modal shown
2. Admin turns OFF "Re-enable User's Links" toggle
3. Warning displayed about links staying disabled
4. Admin clicks "Activate User"
5. System updates user:
   - `isActive = true`
   - `bannedAt = undefined`
   - `bannedReason = undefined`
   - `disableLinksOnBan` remains `true` (links stay disabled)
6. User can now:
   - Login normally
   - Access their dashboard
   - But their links still don't redirect
7. Links remain disabled until:
   - Admin manually enables them, OR
   - User is banned again with links disabled, then unbanned with re-enable

---

### Scenario 6: Banned User Tries to Refresh Token

**Trigger:** Banned user's frontend attempts to refresh access token

**System Response:**

1. Request sent to `/api/auth/refresh` with cookie
2. System finds user by refresh token
3. Checks `user.isActive`
4. If `false`, returns:
   ```json
   {
     "message": "Your account has been suspended. Please contact support for assistance.",
     "banned": true
   }
   ```
5. Clears the JWT cookie
6. Frontend redirects to suspended page

---

### Scenario 7: Protected Route Access by Banned User

**Trigger:** Banned user's valid access token hits a protected API endpoint

**System Response:**

1. `authMiddleware` verifies JWT
2. Fetches user from database
3. Checks `user.isActive`
4. Returns 403 with:
   ```json
   {
     "message": "Your account has been suspended. Please contact support for assistance.",
     "banned": true
   }
   ```
5. Axios interceptor catches 403
6. Clears auth data and redirects

---

### Scenario 8: Admin Tries to Ban Themselves

**Trigger:** Admin clicks ban on their own account

**System Response:**

1. Backend checks if `user._id === req.user.id`
2. Returns 400 Bad Request:
   ```json
   {
     "message": "Cannot ban your own admin account"
   }
   ```
3. No changes made

---

### Scenario 9: Admin Tries to Ban Another Admin

**Trigger:** Admin attempts to ban another admin user

**System Response:**

1. UI hides the ban button for admin users
2. If bypassed, ban can proceed (no backend restriction for admin-to-admin bans)
3. Banned admin loses access like any other user

**Note:** The UI prevents this by hiding the ban button for admin role users.

### Scenario 10: User Submits Appeal (Limit Not Reached)

**Trigger:** Banned user submits appeal form on `/account-suspended`

**System Response:**

1.  Frontend sends POST to `/api/appeals` with `appealToken`.
2.  Backend verifies token and checks `appealsCount` < 3.
3.  Creates `Appeal` record.
4.  Returns success message.
5.  Frontend shows "Appeal Submitted" state.

### Scenario 11: User Submits Appeal (Limit Reached)

**Trigger:** User with 3 rejected appeals tries to submit again

**System Response:**

1.  Backend checks `appealsCount` (e.g., 3).
2.  Returns 400 Bad Request: "Maximum appeal limit reached."
3.  Frontend locks the form and shows "Maximum appeals reached".

---

## API Endpoints

### Ban/Activate User

```
PATCH /api/admin/users/:id/status
```

**Request Body (for banning):**

```json
{
  "reason": "Violation of terms of service",
  "disableLinks": true
}
```

**Response (success):**

```json
{
  "message": "User banned",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": false,
    "bannedAt": "2025-12-02T10:30:00.000Z",
    "bannedReason": "Violation of terms of service",
    "disableLinksOnBan": true,
    "createdAt": "2025-01-15T08:00:00.000Z"
  }
}
```

### Login (Banned User Response)

```
POST /api/auth/login
```

**Response (403 - Banned):**

```json
{
  "message": "Your account has been suspended.",
  "banned": true,
  "bannedReason": "Violation of terms of service",
  "bannedAt": "2025-12-02T10:30:00.000Z",
  "support": {
    "email": "support@linksnap.com",
    "message": "If you believe this is a mistake, please contact our support team."
  }
}
```

---

## Frontend Components

### BanUserModal

**Location:** `client/src/components/BanUserModal.jsx`

**Features:**

- Displays user info (email, name, avatar)
- Warning message about immediate effect
- Reason textarea (optional, 500 char limit)
- Toggle switch for link disable option
- Cancel and Ban buttons
- Loading state during submission

### UnbanUserModal

**Location:** `client/src/components/UnbanUserModal.jsx`

**Features:**

- Displays user info (email, name, avatar)
- Info message about restoring access
- Toggle switch for link re-enable option (only shown if user had links disabled)
- Warning if choosing not to re-enable links
- Cancel and Activate buttons
- Loading state during submission

### AccountSuspended Page

**Location:** `client/src/pages/AccountSuspended.jsx`

**Displays:**

- Shield icon with suspended message
- Ban reason (if provided)
- Support contact information
- Instructions for appeal
- Back to home button

### User Dashboard - Banned State

**Location:** `client/src/pages/UserDashboard.jsx`

**Features:**

- Banner warning when user's links are disabled due to suspension
- Visual disabled state for each link card (grayed out, orange border)
- "Disabled (Account Suspended)" badge on each link
- Copy/Open buttons disabled for suspended links
- QR codes shown with reduced opacity

### Admin Dashboard - Links Table

**Location:** `client/src/pages/AdminDashboard.jsx`

**Features:**

- "Owner Banned" badge on links owned by banned users
- Visual distinction for owner-banned links (orange tint)
- Status column shows both link status and owner ban status
- Owner column shows "Banned" indicator

### Axios Interceptor

**Location:** `client/src/api/axios.js`

**Handles:**

- Detects 403 responses with `banned: true`
- Clears localStorage tokens
- Stores ban info in sessionStorage
- Redirects to `/account-suspended`

---

## Security Considerations

### Immediate Effect

The ban system is designed to take effect as quickly as possible:

1. **Refresh Tokens** - Cleared immediately, preventing new access tokens
2. **Access Tokens** - Protected routes check `isActive` on every request
3. **No Delay** - User cannot perform any actions after ban

### Protection Against Self-Ban

Admins cannot ban their own account to prevent accidental lockout.

### Token Cleanup

When a user is banned:

- All refresh tokens are removed from the database
- The user cannot obtain new access tokens
- Existing access tokens expire naturally (short-lived by design)

### Cache Invalidation

When a user is banned or unbanned:

1. System queries all URLs created by the user
2. For each URL, invalidates both `shortId` AND `customAlias` from cache
3. Uses `invalidateMultiple()` for efficient batch invalidation
4. Next request will fetch fresh data and check current ban status

This ensures:

- Bans take effect immediately for all links
- Unbans restore links immediately
- No stale cache causing incorrect behavior
- Both random short IDs and custom aliases are properly invalidated

### Cache Structure

The URL cache stores owner information for ban checks:

```javascript
{
  originalUrl: 'https://example.com',
  isActive: true,
  _id: ObjectId,
  ownerId: ObjectId  // Used for ban status checks
}
```

---

## Configuration

### Default Settings

| Setting               | Default   | Description                                |
| --------------------- | --------- | ------------------------------------------ |
| `disableLinksOnBan`   | `true`    | New bans disable links by default          |
| Access Token Expiry   | 15 min    | Time until banned user is fully logged out |
| Ban Reason Max Length | 500 chars | Maximum characters for ban reason          |

### Support Contact

The support email shown to banned users is configured in the auth controller:

```javascript
support: {
  email: 'support@linksnap.com',
  message: 'If you believe this is a mistake, please contact our support team.'
}
```

---

## Troubleshooting

### Banned User Still Has Access

**Possible Causes:**

1. Access token hasn't expired yet (wait up to 15 minutes)
2. Frontend cached user state (hard refresh needed)

**Solution:**
Access token expiry ensures eventual logout. For immediate effect, the authMiddleware checks `isActive` on every protected request.

### Links Still Working After Ban

**Possible Causes:**

1. `disableLinksOnBan` was set to `false` during ban
2. Link is cached (cache includes owner check, so should still work)

**Solution:**
Check user's `disableLinksOnBan` setting. Admin can re-ban with different setting.

### User Can't Login After Unban

**Possible Causes:**

1. Browser has cached suspended page
2. SessionStorage still has ban info

**Solution:**
Clear browser data or use incognito mode.

---

## Future Enhancements

Potential improvements to consider:

1. **Temporary Bans** - Auto-unban after specified duration (Partially implemented in backend)
2. **Ban History** - Track all bans/unbans for a user (Implemented in backend)
3. **Bulk Ban** - Ban multiple users at once
4. **Ban Templates** - Pre-defined ban reasons for common violations

---

_Last Updated: December 3, 2025_
