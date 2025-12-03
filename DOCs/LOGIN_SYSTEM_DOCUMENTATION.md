# Link Snap - Login System Documentation

## 1. Overview

The Link Snap authentication system is built on a robust **Double Token (JWT)** architecture designed for maximum security and user experience. It incorporates strict validation, rate limiting, and a sophisticated ban enforcement mechanism that integrates directly with the appeal system.

---

## 2. Authentication Architecture

### A. Token Strategy

We use a dual-token pattern to balance security and usability:

1.  **Access Token (Short-Lived)**

    - **Lifespan**: 15 minutes.
    - **Storage**: In-memory (React State) on the client.
    - **Usage**: Sent in the `Authorization: Bearer <token>` header for API requests.
    - **Security**: Minimizes the window of opportunity if a token is stolen.

2.  **Refresh Token (Long-Lived)**
    - **Lifespan**: 7 days.
    - **Storage**: `HttpOnly`, `Secure`, `SameSite=Strict` Cookie.
    - **Usage**: Automatically sent to `/api/auth/refresh` to obtain new access tokens.
    - **Security**: Immune to XSS attacks (JavaScript cannot read it).

### B. Token Rotation & Reuse Detection

- **Rotation**: Every time a refresh token is used, it is invalidated and replaced with a new one.
- **Reuse Detection**: If an old (already used) refresh token is presented, the system assumes theft and **invalidates the entire token family** (logging the user out from all devices).

---

## 3. The Login Flow

### Step 1: Input Validation

Incoming requests are validated using **Zod** schemas (`loginSchema`) to ensure data integrity before hitting the database.

- **Email**: Must be a valid email format.
- **Password**: Minimum 6 characters.

### Step 2: Rate Limiting

The `authLimiter` middleware protects against brute-force attacks:

- **Limit**: 5 attempts per 15 minutes per IP address.
- **Response**: 429 Too Many Requests.

### Step 3: Credential Verification

- The system looks up the user by email.
- Passwords are compared using `bcrypt` (hashed comparison).

### Step 4: Security Checks (Critical)

#### A. Ban Check (The "Secure Appeal" Logic)

Before allowing login, the system checks `user.isActive`.

- **If Banned (`isActive: false`)**:
  1.  The login is **rejected** immediately (403 Forbidden).
  2.  A specialized **`appealToken`** (JWT) is generated.
      - _Payload_: `{ id: user._id, type: 'appeal' }`
      - _Expiry_: 1 hour.
  3.  **Response**: Returns the `appealToken` and ban details (`reason`, `bannedAt`).
  4.  **Frontend Action**: Redirects user to `/account-suspended` where they can use the `appealToken` to submit an appeal securely.

#### B. Email Verification Check

- If `Settings.requireEmailVerification` is enabled and `user.isVerified` is false:
  - Login is rejected (401 Unauthorized).
  - User is prompted to verify their email.

### Step 5: Session Creation

If all checks pass:

1.  **Access Token** is generated.
2.  **Refresh Token** is generated and pushed to the user's `refreshTokens` array in MongoDB.
3.  **Login History** is logged (IP, User Agent, Success status).
4.  **Response**: Returns user profile + Access Token (JSON) and sets Refresh Token (Cookie).

---

## 4. Security Features

### 🛡️ Account Suspension Enforcement

- **Login Block**: Banned users cannot generate new access tokens.
- **Session Kill**: The `/refresh` endpoint checks ban status. If a user is banned while logged in, their next token refresh attempt will fail (403), logging them out immediately.
- **Appeal Isolation**: The appeal system requires the specific `appealToken` issued during the failed login attempt. This prevents malicious actors from submitting appeals on behalf of others.

### 🛡️ Login History Tracking

Every login attempt (success or failure) is recorded in the `LoginHistory` collection:

- **Data**: User ID, Email, IP Address, User Agent, Status, Failure Reason.
- **Purpose**: Audit trails and detecting suspicious activity patterns.

### 🛡️ Password Security

- **Hashing**: Passwords are never stored in plain text. We use `bcrypt` with a salt work factor.
- **Change Password**: Requires verifying the _current_ password before setting a new one.

---

## 5. API Endpoints

| Method | Endpoint                        | Description              | Access                |
| :----- | :------------------------------ | :----------------------- | :-------------------- |
| `POST` | `/api/auth/register`            | Register new user        | Public (Rate Limited) |
| `POST` | `/api/auth/login`               | Authenticate user        | Public (Rate Limited) |
| `POST` | `/api/auth/logout`              | Clear refresh token      | Public                |
| `GET`  | `/api/auth/refresh`             | Get new access token     | Public (Cookie)       |
| `GET`  | `/api/auth/me`                  | Get current user profile | Private               |
| `PUT`  | `/api/auth/me`                  | Update profile           | Private               |
| `PUT`  | `/api/auth/change-password`     | Change password          | Private               |
| `GET`  | `/api/auth/verify-email/:token` | Verify email address     | Public                |

---

## 7. Data Persistence Strategy

To ensure performance and security, we split data storage between volatile memory and persistent database storage.

### A. In-Memory (Volatile)

_These items are lost on server restart or browser refresh._

1.  **Access Tokens**: Stored in React State (Client RAM).
    - **Why?** Security. If stored in `localStorage`, they are vulnerable to XSS attacks (malicious scripts reading storage). In memory, they are inaccessible to outside scripts and vanish when the tab closes.
2.  **Rate Limit Counters**: The `express-rate-limit` middleware uses `MemoryStore` by default.
    - **Why?** Performance. Rate limits are checked on _every single request_. Querying the database 1000 times/second just to count requests would crash the database. RAM is instant.
3.  **Appeal Tokens**: Stored in `sessionStorage` (Browser Tab Memory).
    - **Why?** Scope. These are temporary credentials valid only for the current "Appeal Session". They should auto-expire when the user closes the tab.
4.  **React Application State**: User profile, dashboard data, and form inputs.
    - **Why?** UI Responsiveness. UI state needs to update in milliseconds. Waiting for a database write for every input change would make the app unusable.

### B. Database (Persistent)

_These items are stored in MongoDB and survive restarts._

1.  **User Accounts**: Email, Password (Hashed), Profile info.
2.  **Refresh Tokens**: Stored in the `User.refreshTokens` array to allow for "Force Logout" (by removing them from DB).
3.  **Verification Tokens**: Stored in `User.verificationToken` to persist across sessions until the user clicks the email link.
4.  **Ban Data**: `isActive`, `bannedAt`, `bannedReason`, and the full `BanHistory` log.
5.  **Appeals**: All submitted appeals are stored in the `Appeal` collection for admin review.
6.  **Login History**: Every login attempt is logged in the `LoginHistory` collection for security auditing.

---

## 8. Frontend Integration Guide

### Handling Login Response

The frontend `login` function handles three main outcomes:

1.  **Success (200)**: Stores `accessToken` in memory, redirects to Dashboard.
2.  **Banned (403)**:
    - Captures `appealToken` and ban details from response.
    - Stores them in `sessionStorage` (prefixed with `ban...`).
    - Redirects to `/account-suspended`.
3.  **Unverified (401)**: Shows error message prompting verification.

### Auto-Logout on Ban

The `Axios` interceptor monitors for 403 responses on the `/refresh` endpoint. If detected, it clears local state and redirects to the login page or suspension page, ensuring banned users are removed from the system immediately.
