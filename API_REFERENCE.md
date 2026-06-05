# HYIP Platform — Full API Reference

> **Base URL:** `https://<your-replit-domain>/api`
> **Server port:** 5000

---

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are JWTs. They expire (check `JWT_EXPIRES_IN` env var). On expiry use `POST /api/auth/refresh-token`.

**Admin-only endpoints** additionally require the authenticated user to have `role: "admin"` in the database.

---

## Rate Limits

| Route group | Limit (per 15 min window) |
|---|---|
| `/api/auth/*` | 20 requests per IP |
| All other routes (regular users) | 1000 requests |
| All other routes (premium users) | 2000 requests |
| Admin users | Bypass (if `RATE_LIMIT_ADMIN_BYPASS=true`) |

Rate limit errors return `HTTP 429` with `{ "error": "Too many requests, please try again later." }`.

---

## Standard Error Responses

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request / validation failed |
| 401 | Missing or invalid token |
| 403 | Forbidden (wrong role, account suspended, etc.) |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already registered) |
| 429 | Rate limited |
| 500 | Internal server error |

Account lockout: after 5 failed logins, the account is locked for 15 minutes. Login returns `403` with `{ "error": "Account locked. Try again after <time>." }`.

---

## Health Check

### `GET /api/health`
No auth required.

**Response 200**
```json
{ "status": "OK", "timestamp": "2026-06-05T00:00:00.000Z" }
```

---

## Auth — `/api/auth`

### `POST /api/auth/register`
Create a new user account.

**Body**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "country": "US",
  "referral_code": "ABC123"   // optional
}
```

**Response 201**
```json
{
  "message": "User registered successfully",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user",
    "kyc_verified": false
  }
}
```

---

### `POST /api/auth/login`
Authenticate and receive a token.

**Body**
```json
{ "email": "user@example.com", "password": "Password123!" }
```

**Response 200**
```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user",
    "kyc_verified": false
  }
}
```

---

### `POST /api/auth/logout`
🔒 Requires auth. Invalidates the current JWT (adds JTI to blacklist).

**Response 200**
```json
{ "message": "Logged out successfully" }
```

---

### `POST /api/auth/refresh-token`
Exchange a valid (non-expired) token for a fresh one.

**Body**
```json
{ "token": "<current_jwt>" }
```

**Response 200**
```json
{ "token": "<new_jwt>" }
```

---

### `POST /api/auth/request-password-reset`
Sends a reset link to the user's email.

**Body**
```json
{ "email": "user@example.com" }
```

**Response 200**
```json
{ "message": "Password reset email sent" }
```

---

### `POST /api/auth/reset-password`
Complete a password reset using the token from the email link.

**Body**
```json
{ "token": "<reset_token>", "password": "NewPassword123!" }
```

**Response 200**
```json
{ "message": "Password reset successfully" }
```

---

## User — `/api/user`
All endpoints require auth (`Authorization: Bearer <token>`).

### `GET /api/user/profile`
Returns the authenticated user's profile.

**Response 200**
```json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "country": "US",
  "role": "user",
  "kyc_verified": false,
  "kyc_status": "pending",
  "referral_code": "ABC123",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

---

### `PUT /api/user/profile`
Update profile fields.

**Body** (all optional)
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "country": "US"
}
```

**Response 200**
```json
{ "message": "Profile updated successfully" }
```

---

### `PUT /api/user/password`
Change password.

**Body**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

**Response 200**
```json
{ "message": "Password changed successfully" }
```

---

### `GET /api/user/wallet`
Full wallet details including all currency balances.

**Response 200**
```json
{
  "id": 1,
  "user_id": 1,
  "btc_address": "bc1q...",
  "eth_address": "0x...",
  "usdt_address": "T...",
  "btc_balance": "0.00100000",
  "eth_balance": "0.05000000",
  "usdt_balance": "100.00",
  "usd_balance": "500.00"
}
```

---

### `GET /api/user/wallet/balance`
Returns balance summary only.

**Response 200**
```json
{
  "btc_balance": "0.00100000",
  "eth_balance": "0.05000000",
  "usdt_balance": "100.00",
  "usd_balance": "500.00"
}
```

---

### `PUT /api/user/wallet`
Update wallet crypto addresses.

**Body** (all optional)
```json
{
  "btc_address": "bc1q...",
  "eth_address": "0x...",
  "usdt_address": "T..."
}
```

**Response 200**
```json
{ "message": "Wallet updated successfully" }
```

---

### `GET /api/user/subscriptions`
All subscriptions (active + expired) for the authenticated user.

**Response 200**
```json
[
  {
    "id": 1,
    "plan_id": 2,
    "plan_name": "Gold Plan",
    "amount_invested": "1000.00",
    "daily_profit_rate": "0.0150",
    "status": "active",
    "start_date": "2026-01-01",
    "end_date": "2026-04-01",
    "total_earned": "135.00"
  }
]
```

---

### `GET /api/user/active-subscriptions`
Active subscriptions only.

**Response 200** — same shape as above, filtered to `status: "active"`.

---

### `POST /api/user/subscriptions/create`
Create a new subscription (invest in a plan).

**Body**
```json
{
  "plan_id": 2,
  "amount": 1000,
  "currency": "usd"    // "usd" | "btc" | "eth" | "usdt"
}
```

**Response 201**
```json
{
  "message": "Subscription created successfully",
  "subscription": { "id": 5, "plan_id": 2, "amount_invested": "1000.00", "status": "active" }
}
```

---

### `GET /api/user/earnings`
Earnings history from daily profit payouts.

**Response 200**
```json
[
  {
    "id": 1,
    "subscription_id": 1,
    "amount": "15.00",
    "earned_date": "2026-01-02",
    "created_at": "2026-01-02T00:00:00.000Z"
  }
]
```

---

### `POST /api/user/earnings/transfer-to-wallet`
Move accumulated earnings into the wallet balance.

**Response 200**
```json
{ "message": "Earnings transferred to wallet", "amount_transferred": "135.00" }
```

---

### `GET /api/user/transactions`
Full transaction history for the user (deposits, withdrawals, earnings).

**Response 200**
```json
[
  {
    "id": 1,
    "type": "deposit",
    "amount": "500.00",
    "currency": "usd",
    "status": "completed",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### `GET /api/user/kyc`
KYC submission status and list of submitted documents.

**Response 200**
```json
{
  "kyc_verified": false,
  "kyc_status": "pending",
  "documents": [
    {
      "id": 1,
      "document_type": "passport",
      "file_path": "/uploads/kyc/1-1234567890-passport.jpg",
      "status": "pending",
      "submitted_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/user/kyc/documents`
Upload a KYC document. `multipart/form-data`.

**Form fields**
| Field | Type | Notes |
|---|---|---|
| `document` | File | JPEG or PNG only, max 10 MB |
| `document_type` | string | e.g. `"passport"`, `"id_card"`, `"utility_bill"` |

**Response 201**
```json
{
  "message": "KYC document submitted successfully",
  "document": { "document_type": "passport", "file_path": "...", "status": "pending" }
}
```

---

### `POST /api/user/withdraw`
Request a withdrawal from wallet balance.

**Body**
```json
{
  "amount": 200,
  "currency": "usdt",
  "wallet_address": "T..."
}
```

**Response 201**
```json
{
  "message": "Withdrawal request submitted",
  "withdrawal": { "id": 3, "amount": "200.00", "currency": "usdt", "status": "pending" }
}
```

---

### `GET /api/user/withdrawal-requests`
List of the user's withdrawal requests.

**Response 200**
```json
[
  {
    "id": 3,
    "amount": "200.00",
    "currency": "usdt",
    "wallet_address": "T...",
    "status": "pending",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
]
```

---

## Plans — `/api/plans`
All public. No auth required.

### `GET /api/plans`
List all active investment plans.

**Response 200**
```json
[
  {
    "id": 1,
    "name": "Starter",
    "description": "Entry level plan",
    "min_investment": "100.00",
    "max_investment": "999.00",
    "daily_profit_rate": "0.0100",
    "duration_days": 30,
    "status": "active"
  }
]
```

---

### `GET /api/plans/:id`
Single plan details.

---

### `POST /api/plans/:id/subscribe`
🔒 Requires auth. Subscribe to a plan (alternative to `POST /api/user/subscriptions/create`).

**Body**
```json
{ "amount": 500, "currency": "usd" }
```

**Response 201** — same shape as subscription creation.

---

## Transactions — `/api/transactions`
All require auth unless noted.

### `POST /api/transactions/initiate-deposit`
Start a deposit — returns wallet address to send funds to.

**Body**
```json
{ "amount": 500, "currency": "btc" }
```

**Response 201**
```json
{
  "deposit_id": 12,
  "amount": "500.00",
  "currency": "btc",
  "wallet_address": "bc1q...",
  "status": "pending"
}
```

---

### `GET /api/transactions/deposit/:depositId`
Get details of a specific deposit.

---

### `GET /api/transactions/deposit/:depositId/proof`
Download the payment proof image for a deposit (authenticated).

---

### `POST /api/transactions/deposit/:depositId/upload-proof`
Upload a payment proof screenshot. `multipart/form-data`.

**Form fields**
| Field | Type | Notes |
|---|---|---|
| `proof_image` | File | JPEG, PNG, GIF, WEBP, HEIC — max 15 MB |

**Response 200**
```json
{ "message": "Proof uploaded successfully" }
```

---

### `GET /api/transactions/deposits/pending`
List the authenticated user's pending deposits.

---

### `POST /api/transactions/withdraw`
Request a withdrawal (alternative to `POST /api/user/withdraw`).

**Body**
```json
{ "amount": 100, "currency": "eth", "wallet_address": "0x..." }
```

---

### `GET /api/transactions/withdrawal-requests`
The authenticated user's withdrawal requests.

---

### `POST /api/transactions/admin/deposits/:depositId/confirm`
🔒 Admin only. Approve a pending deposit.

**Response 200**
```json
{ "message": "Deposit confirmed successfully" }
```

---

### `POST /api/transactions/admin/deposits/:depositId/reject`
🔒 Admin only. Reject a pending deposit.

**Body**
```json
{ "reason": "Invalid proof of payment" }  // optional
```

---

### `POST /api/transactions/admin/withdrawals/:withdrawalId/approve`
🔒 Admin only. Approve a withdrawal request.

---

### `POST /api/transactions/admin/withdrawals/:withdrawalId/reject`
🔒 Admin only. Reject a withdrawal request.

**Body**
```json
{ "reason": "Insufficient verification" }  // optional
```

---

## Wallets — `/api/wallets`

### `GET /api/wallets/company`
Public. Returns the platform's receiving wallet addresses for deposits.

**Response 200**
```json
{
  "btc": "bc1q...",
  "eth": "0x...",
  "usdt": "T..."
}
```

---

### `POST /api/wallets/company/update`
🔒 Admin only. Update the platform's receiving wallet addresses.

**Body**
```json
{ "btc": "bc1q...", "eth": "0x...", "usdt": "T..." }
```

---

## Referrals — `/api/referrals`
All require auth.

### `POST /api/referrals/track`
Record a referral link click or registration attribution.

**Body**
```json
{ "referral_code": "ABC123" }
```

---

### `GET /api/referrals/stats`
Referral summary for the current user.

**Response 200**
```json
{
  "referral_code": "ABC123",
  "total_referrals": 5,
  "total_commission_earned": "75.00"
}
```

---

### `GET /api/referrals/commissions`
Commission payout history.

**Response 200**
```json
[
  {
    "id": 1,
    "referred_user_id": 8,
    "commission_amount": "15.00",
    "created_at": "2026-02-01T00:00:00.000Z"
  }
]
```

---

## Crypto Prices — `/api/crypto`
All public unless noted.

### `GET /api/crypto/prices`
Live BTC, ETH, USDT prices in USD.

**Response 200**
```json
{ "BTC": 65000.00, "ETH": 3500.00, "USDT": 1.00 }
```

---

### `GET /api/crypto/convert/usd-to-btc?amount=1000`
Convert USD amount to BTC.

**Response 200**
```json
{ "usd": 1000, "btc": "0.01538462" }
```

---

### `GET /api/crypto/convert/usd-to-eth?amount=1000`
Convert USD amount to ETH.

**Response 200**
```json
{ "usd": 1000, "eth": "0.28571429" }
```

---

### `GET /api/crypto/convert/crypto-to-usd?currency=btc&amount=0.01`
Convert crypto amount to USD.

**Query params:** `currency` (`btc` | `eth` | `usdt`), `amount`

**Response 200**
```json
{ "currency": "btc", "amount": 0.01, "usd": 650.00 }
```

---

### `POST /api/crypto/admin/clear-cache`
🔒 Admin only. Force-refresh the price cache.

---

### `POST /api/crypto/admin/update-fallback`
🔒 Admin only. Set manual fallback prices in case the price feed is down.

**Body**
```json
{ "BTC": 65000, "ETH": 3500 }
```

---

## Contact — `/api/contact`
Public.

### `POST /api/contact`
Submit a contact/support message.

**Body**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about withdrawal",
  "message": "How long do withdrawals take?"
}
```

**Response 201**
```json
{ "message": "Message sent successfully" }
```

---

## File Serving — `/uploads`
All require auth. KYC files additionally require admin role.

| Path | Access |
|---|---|
| `GET /uploads/proofs/:filename` | Authenticated users |
| `GET /uploads/kyc/:filename` | Admin only |

---

## Admin — `/api/admin`
All endpoints require auth + admin role.

---

### Dashboard

#### `GET /api/admin/stats`
Platform-wide statistics.

**Response 200**
```json
{
  "total_users": 120,
  "active_subscriptions": 45,
  "pending_withdrawals": 8,
  "pending_kyc": 3,
  "total_invested": "250000.00",
  "total_earnings_paid": "18000.00"
}
```

---

### User Management

#### `GET /api/admin/users`
Paginated user list.

**Query params:** `page`, `limit`, `search` (email/name), `role`, `status`, `kyc_verified`

**Response 200**
```json
{
  "users": [ { "id": 1, "email": "...", "role": "user", "status": "active", "kyc_verified": false, "created_at": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 120, "total_pages": 6 }
}
```

---

#### `GET /api/admin/users/:id`
Full profile for a single user.

---

#### `GET /api/admin/users/:id/subscriptions`
All subscriptions for a user.

---

#### `GET /api/admin/users/:id/transactions`
Full transaction history for a user.

---

#### `GET /api/admin/users/:id/earnings`
Earnings history for a user.

---

#### `GET /api/admin/users/:id/withdrawals`
Withdrawal requests for a user.

---

#### `GET /api/admin/users/:id/kyc-documents`
KYC documents submitted by a user.

---

#### `GET /api/admin/users/:id/password-reset-requests`
Password reset request history for a user.

---

#### `PUT /api/admin/users/:id`
Update a user's profile fields.

**Body** (all optional)
```json
{ "first_name": "Jane", "last_name": "Doe", "email": "jane@example.com", "country": "GB" }
```

---

#### `PATCH /api/admin/users/:id/password`
Force-reset a user's password.

**Body**
```json
{ "password": "NewTemporaryPass123!" }
```

---

#### `DELETE /api/admin/users/:id`
Permanently delete a user account.

**Response 200**
```json
{ "message": "User deleted successfully" }
```

---

#### `PATCH /api/admin/users/:id/role`
Change a user's role.

**Body**
```json
{ "role": "admin" }   // "user" | "admin" | "premium"
```

---

#### `PATCH /api/admin/users/:id/status`
Activate or suspend a user.

**Body**
```json
{ "status": "suspended" }   // "active" | "suspended"
```

---

#### `PATCH /api/admin/users/:id/kyc`
Approve or reject a user's KYC.

**Body**
```json
{ "kyc_status": "approved", "note": "Documents verified" }
// kyc_status: "approved" | "rejected"
```

---

#### `PATCH /api/admin/users/:id/kyc/resubmit`
Allow a user to re-submit KYC documents after rejection.

---

#### `POST /api/admin/users/:id/force-logout`
Immediately invalidate all active tokens for a user.

**Response 200**
```json
{ "message": "User force logged out successfully" }
```

---

### KYC Management

#### `GET /api/admin/users/:id/kyc-documents`
See above under User Management.

---

### Withdrawal Management

#### `GET /api/admin/withdrawals`
All withdrawal requests across all users.

**Query params:** `status` (`pending` | `approved` | `rejected`), `page`, `limit`

**Response 200**
```json
{
  "withdrawals": [
    {
      "id": 3,
      "user_id": 5,
      "user_email": "user@example.com",
      "amount": "200.00",
      "currency": "usdt",
      "wallet_address": "T...",
      "status": "pending",
      "created_at": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "total_pages": 1 }
}
```

---

#### `PATCH /api/admin/withdrawals/:id/approve`
Approve a withdrawal request.

**Response 200**
```json
{ "message": "Withdrawal approved successfully" }
```

---

#### `PATCH /api/admin/withdrawals/:id/reject`
Reject a withdrawal request.

**Body**
```json
{ "reason": "Wallet address mismatch" }  // optional
```

---

### Deposit Management

#### `GET /api/admin/deposits`
All deposits across all users.

**Query params:** `status`, `page`, `limit`

---

#### `PATCH /api/admin/deposits/:id/approve`
Approve a pending deposit.

---

### Wallet Management

#### `GET /api/admin/wallets`
All user wallets.

---

#### `GET /api/admin/wallets/:id/transactions`
Transactions for a specific wallet.

---

#### `PATCH /api/admin/wallets/:id/balance`
Manually adjust a wallet balance.

**Body**
```json
{ "currency": "usd", "amount": "500.00" }
```

---

#### `PATCH /api/admin/wallets/:id`
Update wallet details (addresses, etc.).

---

### Plan Management

#### `GET /api/admin/plans`
All plans including inactive ones.

---

#### `POST /api/admin/plans`
Create a new investment plan.

**Body**
```json
{
  "name": "Gold Plan",
  "description": "High yield plan",
  "min_investment": 1000,
  "max_investment": 9999,
  "daily_profit_rate": 0.015,
  "duration_days": 90,
  "status": "active"
}
```

---

#### `PUT /api/admin/plans/:id`
Update a plan.

---

#### `PATCH /api/admin/plans/:id/status`
Toggle plan status.

**Body**
```json
{ "status": "inactive" }   // "active" | "inactive"
```

---

### Contact Messages

#### `GET /api/admin/contacts`
All submitted contact messages.

---

#### `PATCH /api/admin/contacts/:id/reply`
Reply to a contact message (sends email).

**Body**
```json
{ "reply": "Thank you for reaching out. Your withdrawal will be processed..." }
```

---

### Password Reset Requests

#### `GET /api/admin/password-reset-requests`
All password reset requests submitted by users.

---

## Audit Logs — `/api/admin/audit-logs`
Admin only. Complete tamper-evident trail of all sensitive platform activity.

---

### `GET /api/admin/audit-logs`
Paginated platform-wide audit log.

**Query params**

| Param | Type | Description |
|---|---|---|
| `user_id` | number | Filter by affected user |
| `actor_id` | number | Filter by who performed the action |
| `action` | string | Filter by action type (e.g. `auth.login`) |
| `entity_type` | string | Filter by entity (`user`, `withdrawal`, etc.) |
| `from` | ISO date | Start of date range |
| `to` | ISO date | End of date range |
| `page` | number | Default: 1 |
| `limit` | number | Default: 50, max: 200 |

**Response 200**
```json
{
  "audit_logs": [
    {
      "id": 42,
      "action": "admin.kyc_approved",
      "entity_type": "user",
      "entity_id": 7,
      "ip_address": "203.0.113.1",
      "user_agent": "Mozilla/5.0 ...",
      "metadata": { "document_type": "passport" },
      "created_at": "2026-06-05T10:23:00.000Z",
      "user_id": 7,
      "user_email": "applicant@example.com",
      "actor_id": 1,
      "actor_email": "admin@example.com"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 320, "total_pages": 7 }
}
```

---

### `GET /api/admin/audit-logs/actions`
Returns all distinct action types currently in the audit log — useful for populating filter dropdowns.

**Response 200**
```json
{
  "actions": [
    "auth.login",
    "auth.logout",
    "auth.register",
    "auth.password_reset",
    "user.password_changed",
    "user.kyc_submitted",
    "admin.user_deleted",
    "admin.force_logout",
    "admin.user_role_changed",
    "admin.user_status_changed",
    "admin.kyc_approved",
    "admin.kyc_rejected",
    "admin.withdrawal_approved",
    "admin.withdrawal_rejected"
  ]
}
```

---

### `GET /api/admin/users/:id/audit-logs`
Complete activity trail for a **single user** — includes events they performed themselves AND admin actions taken against them.

**Query params:** same as platform-wide log (`action`, `from`, `to`, `page`, `limit`).

**Response 200**
```json
{
  "user_id": 7,
  "audit_logs": [
    {
      "id": 42,
      "action": "admin.kyc_approved",
      "entity_type": "user",
      "entity_id": 7,
      "ip_address": "203.0.113.1",
      "user_agent": "...",
      "metadata": {},
      "created_at": "2026-06-05T10:23:00.000Z",
      "user_id": 7,
      "user_email": "applicant@example.com",
      "actor_id": 1,
      "actor_email": "admin@example.com"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 14, "total_pages": 1 }
}
```

---

## Audit Action Reference

| Action | Trigger |
|---|---|
| `auth.register` | New user signs up |
| `auth.login` | Successful login |
| `auth.logout` | User logs out |
| `auth.password_reset` | Password reset completed |
| `user.password_changed` | User changes their own password |
| `user.kyc_submitted` | User uploads a KYC document |
| `admin.user_deleted` | Admin deletes a user account |
| `admin.force_logout` | Admin force-invalidates a user's tokens |
| `admin.user_role_changed` | Admin changes a user's role |
| `admin.user_status_changed` | Admin activates or suspends a user |
| `admin.kyc_approved` | Admin approves KYC documents |
| `admin.kyc_rejected` | Admin rejects KYC documents |
| `admin.withdrawal_approved` | Admin approves a withdrawal request |
| `admin.withdrawal_rejected` | Admin rejects a withdrawal request |

---

## CORS

The backend accepts requests from:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://hyipro-frontend.pages.dev`
- Value of `FRONTEND_URL` env var

To allow your new frontend origin, add it to the `FRONTEND_URL` environment variable or the `allowedOrigins` array in `src/app.js`.

---

## Environment Variables (relevant to frontend integration)

| Variable | Purpose |
|---|---|
| `FRONTEND_URL` | Your frontend's origin (added to CORS allowlist) |
| `JWT_SECRET` | Used to sign tokens — never expose to client |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`, `24h`) |

---

*Generated from source: `src/routes/` + `src/app.js` — June 2026*
