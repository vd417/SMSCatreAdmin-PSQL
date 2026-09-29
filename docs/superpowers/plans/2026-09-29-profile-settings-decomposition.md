# Profile & Settings — decomposition / backlog

Status: **NOT STARTED** (decomposition approved for saving 2026-09-29; each sub-project still needs its own spec → plan → build). No code written for SP-1…SP-6 yet.

## Intent
Turn the catreadmin (operator/admin SaaS) Profile + Settings from stubs into a
production SaaS account/preferences area. Owner is the operator staff member using
the panel. Rule from the user: **check the existing backend first and reuse APIs —
do not build duplicate endpoints.**

## Already shipped (2026-09-29, in D:\SMS copy)
- `ProfileScreen` wired to account menu ("My profile"): view details, change photo
  (`PATCH /me/photo`), change password (`POST /auth/set-password`).
- `SettingsScreen` (thin): theme light/dark (client-only, App `setTheme`).
- `api/auth.ts` `updatePhoto()`; `Me` type extended with profile fields.
- Routes/menu/crumb wired in `App.tsx`. Settings stays owner-gated (`settings.view`).
- Tests green (full suite 151 passed at time of writing).

## Capability matrix (audit 2026-09-29 — reuse vs new backend)
- **My Profile — mixed, leans NEW.** Reuse: `GET /auth/me`, `PATCH /me/photo`,
  `POST /auth/set-password`, audit query `GET /v1/audit?actor_id=` (platform-gated).
  New: self-edit name/phone (no `PATCH /me`), email verified status + verify flow
  (no column/flow), active sessions + sign-out-all (RefreshTokens table has no
  device/IP cols and no revoke-all), per-user OTP/MFA toggle (none).
- **Settings→Personal — light EXTEND.** `GET/PATCH /v1/me/settings` + `UserAppSettings`
  table exist but hold only 3 booleans (ChatAlerts, SchoolNotices, InAppToasts).
  Add theme/landing/sidebar/density/page-size/date/time/timezone. FE UI new.
  (Endpoints: `MeSchoolsController`; repo `UserAppSettingsRepository`.)
- **Settings→Security — mostly NEW.** Config-only/hardcoded: password policy inline
  (≥8; set-password enforces nothing), session TTL in appsettings, no lockout / no
  failed-attempt tracking, no session IP/device.
- **Workspace/SaaS — mostly REUSE.** School profile `PATCH /v1/me/schools/{id}`
  (name/logo/contact/country), Razorpay per-tenant creds (`/v1/school/integrations`),
  plans (`/v1/plans`), subscriptions (`/v1/subscriptions`). New: currency/timezone/
  favicon fields, runtime SMTP (config-only today), runtime-editable feature flags
  (currently tier-derived `TierFeatureSet`, not editable).
- **Notifications — REUSE (+optional expand).** `/v1/notifications` list/read/create
  + the 3 per-user toggles. Granular per-type matrix would be new.
- **System/Admin — MIXED.** Operator-team permission MATRIX is client-side only
  (`src/auth/rbac.ts`; IdentityScreen edits are preview/local, never persisted).
  School-tenant RBAC IS persisted (`UserController` roles/permissions +
  `RoleTemplateOverrides`) — a pattern to copy. API keys/webhooks: none. Health:
  `/health` is a stub returning `{status:"ok"}`.

## Decomposition (each = own spec → plan → build)
- **SP-1 · Profile completion** (small–medium): self-edit name+phone (new `PATCH /me`),
  harden change-password (verify current pw + enforce policy), show last login
  (expose `Users.LastSeenAt` in `/auth/me`), "My recent activity" (self-scoped audit).
  Email read-only. *Builds on the shipped Profile screen.*
- **SP-2 · Personal preferences** (small): extend `UserAppSettings` with theme/landing/
  sidebar/density/page-size/date-time/timezone; new Settings→Personal UI + prefs layer
  wired into tables/formatters; move theme from localStorage to server-backed.
- **SP-3 · Security & sessions** (large): sessions/devices (RefreshTokens schema +
  IP/device capture + list), sign-out-all, per-user MFA/OTP toggle, lockout,
  configurable password policy/timeout.
- **SP-4 · Workspace/SaaS (owner)** (medium, mostly reuse): brand/logo/support/currency/
  timezone/favicon, runtime SMTP, runtime feature flags.
- **SP-5 · Notifications preferences** (small): surface the 3 toggles now; expand to a
  per-type matrix later.
- **SP-6 · System/Admin** (large): persist the operator permission matrix, API keys/
  webhooks, real health/readiness endpoint.

## Recommended order
SP-1 → SP-2 first (high value, contained, finishes the started work). Then SP-3
(Security) as its own spec (migrations + auth changes). SP-4/5/6 after.
User's stated preference was 1+2+3 first; note SP-3 is the heaviest/most greenfield.

## Repo notes
- Frontend runs from `D:\SMS\sms-project\sms-catreadmin` (Vite 5275, canonical/up-to-date).
- Backend `D:\convert\SMS backend\sms-api` (API 5262). Profile/settings work spans both.
