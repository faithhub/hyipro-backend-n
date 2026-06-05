---
name: Security hardening decisions
description: Non-obvious security choices made during the audit of the HYIP backend.
---

# Security hardening decisions

## Auth middleware DB status check
`src/middleware/auth.js` does a DB lookup on every authenticated request to get the current user status/role. A Map-based cache with 1-minute TTL keeps DB load low. When admin suspends or changes role, `invalidateStatusCache(userId)` must be called — it is called inside `updateUserStatus` and `updateUserRole` in adminController.

**Why:** JWT payload is stale — a suspended user's token stays valid until expiry (default 7d) without this check.

**How to apply:** Any place that changes `users.status` or `users.role` should call `invalidateStatusCache(userId)` from `src/middleware/auth.js`.

## Account lockout
5 failed login attempts → 15-minute lockout stored in `users.locked_until`. Columns: `failed_login_attempts INT DEFAULT 0`, `locked_until TIMESTAMP NULL`. Reset to 0 / NULL on successful login.

**Why:** Per-account lockout catches credential stuffing that IP rate-limiting misses (distributed attacks, residential proxies).

## File magic-byte validation
`src/utils/fileMagic.js` reads first 16 bytes from disk after multer saves the file. If bytes don't match JPEG/PNG/GIF/WebP signatures, file is deleted and request is rejected. HEIC/HEIF skipped (no standard magic bytes).

**Why:** `file.mimetype` in multer comes from the HTTP Content-Type header — trivially spoofable. Magic bytes are the actual file content.

## KYC files are admin-only
`/uploads/kyc/:file` requires `authMiddleware` + role === 'admin'. Previously completely unauthenticated.

**Why:** KYC files contain government IDs and passports — must never be publicly accessible.

## JWT token blacklist / revocation
Every JWT now includes a `jti` (UUID via `crypto.randomUUID()`) in its payload. `src/utils/tokenBlacklist.js` maintains an in-memory Set of revoked JTIs backed by the `token_blacklist` DB table. On startup, all non-expired JTIs are loaded into the Set. Hourly cron purges expired rows and rebuilds the Set.

- `POST /api/auth/logout` — adds the caller's JTI to the blacklist (individual logout)
- `POST /api/admin/users/:id/force-logout` — sets `users.force_logout_at = NOW()`; `authMiddleware` rejects any token whose `iat * 1000 < force_logout_at` (force-logout all sessions without enumerating tokens)

**Why:** JWT statelessness means a token stays valid until expiry even after logout or suspension. JTI blacklist + force_logout_at covers both cases efficiently.

**How to apply:** Any place that issues a new token uses `generateToken()` (which adds `jti`). Any place that must invalidate all of a user's sessions calls `forceLogoutUser(userId)` from tokenBlacklist.js. Cache invalidation via `invalidateStatusCache(userId)` must accompany any force_logout_at write.

## Bcrypt cost factor
All new password hashes use cost 12 (was 10).

## Joi validation
`src/middleware/validate.js` uses joi schemas for register, login, requestPasswordReset, resetPassword routes. Rejects unknown fields (abortEarly: false, allowUnknown: false).
