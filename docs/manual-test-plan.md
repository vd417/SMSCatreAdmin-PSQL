# CATRE · SUPER ADMIN PANEL — MANUAL TEST SPECIFICATION

**Document type:** Manual / functional test cases
**Application:** Catre Operator Control Plane (frontend)
**Tech:** Vite + React + TypeScript · REST API · RBAC
**Scope:** Catre Admin web app only

---

## A. DOCUMENT CONVENTIONS

- **TC ID** — unique test case identifier.
- **Priority** — P1 (critical path), P2 (important), P3 (minor/cosmetic).
- **Precondition** — state/role required before the test.
- **Steps** — exact, numbered actions.
- **Expected** — observable result (UI change, toast text, navigation).
- **Toast text** is quoted exactly as the app shows it.
- Mark each run **Pass / Fail / Blocked** with Tester, Date, Build, Notes.

**Suggested result table (per case):**

| Field | Value |
|---|---|
| Executed by | |
| Date / Build | |
| Result | Pass / Fail / Blocked |
| Actual result | |
| Defect ID | |

---

## B. TEST ENVIRONMENT

| Item | Detail |
|---|---|
| Frontend | `http://localhost:5173` |
| API base URL | `http://localhost:5262/v1` (value in `.env`; `.env.example` default `5162`) |
| Backend | sms-api must be running and reachable |
| Auth | Email + Password; first-time password set via emailed 6-digit OTP |
| Seed operator | `catre.tech@gmail.com` |
| Locale | ₹ INR, en-IN dates (DD Mon YYYY) |
| Browser | Latest Chrome/Edge; also verify responsive/mobile width (<768px) |

**Test accounts to prepare (one per role):** Owner, Admin, Support, Sales, Finance, Analyst. The account's **first role** is the effective role.

**Test data to prepare in backend:**
- At least 1 client per status: trial, active, hold, deactivated, suspended, cancelled.
- 1 owner with **multiple schools** (same contact email) and 1 with a single school.
- 1 school with **0 students and 0 staff** (for delete test).
- Invoices in each state: paid, open, past_due.
- Upgrade requests: pending_offline, paid_pending_approval, pending_payment, approved, rejected.
- Tickets in open, pending, resolved, closed with varied priority and assignee.
- Plans: published + draft, flat + per-student, with/without offer.

---

## C. GLOBAL RBAC REFERENCE

Permissions map (role → access). Use this to predict which buttons appear.

| Permission | Owner | Admin | Support | Sales | Finance | Analyst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| dashboard.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| clients.view / usage.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| clients.start_trial | ✓ | ✓ | | ✓ | | |
| clients.activate | ✓ | ✓ | | | ✓ | |
| clients.suspend | ✓ | ✓ | | | | |
| clients.reinstate | ✓ | ✓ | | | ✓ | |
| clients.cancel | ✓ | ✓ | | | | |
| clients.change_plan | ✓ | ✓ | | ✓ | ✓ | |
| clients.delete | ✓ | | | | | |
| clients.impersonate | ✓ | ✓ | ✓ | | | |
| clients.manage_people | ✓ | ✓ | | | | |
| onboarding.view | ✓ | ✓ | ✓ | ✓ | | |
| onboarding.manage | ✓ | ✓ | | ✓ | | |
| plans.view | ✓ | ✓ | | ✓ | ✓ | |
| plans.manage | ✓ | ✓ | | | ✓ | |
| billing.view | ✓ | ✓ | | ✓ | ✓ | |
| billing.manage_invoice | ✓ | ✓ | | | ✓ | |
| billing.refund | ✓ | | | | ✓ | |
| support.view / support.manage | ✓ | ✓ | ✓ | | | |
| team.view / team.manage | ✓ | ✓ | | | | |
| settings.view / settings.manage | ✓ | | | | | |
| reports.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| identity.view / identity.manage | ✓ | ✓ | | | | |

> Note: the lifecycle action set in the UI uses **hold/release/deactivate/reactivate** in addition to suspend/reinstate/cancel. `clients.change_plan` roles: Owner, Admin, Sales, Finance.

---

# MODULE 1 — AUTHENTICATION

### TC-AUTH-01 · Sign in with valid credentials · P1
**Precondition:** Have a valid email + password; not signed in.
**Steps:**
1. Navigate to `http://localhost:5173`.
2. Confirm the Login screen shows heading "Sign in to your account" and subtext "Platform administrators only."
3. In **Email**, type the valid email (e.g. `catre.tech@gmail.com`).
4. In **Password**, type the valid password.
5. Verify the **Sign in** button becomes enabled (it is disabled while either field is empty).
6. Click **Sign in**.
**Expected:**
- Button label changes to "Signing in…".
- On success the app shell loads, defaulting to **Dashboard**.
- Sidebar shows only the groups/items permitted for the user's role.

### TC-AUTH-02 · Sign in with wrong password · P1
**Precondition:** Valid email, wrong password.
**Steps:** 1. Enter valid email. 2. Enter an incorrect password. 3. Click **Sign in**.
**Expected:** Red inline error **"Incorrect email or password"**; user stays on Login; no navigation.

### TC-AUTH-03 · Sign in with malformed/unknown email · P2
**Steps:** 1. Enter an unknown or malformed email + any password. 2. Click **Sign in**.
**Expected:** Error shown ("Incorrect email or password" for unknown; browser email validation may block clearly invalid addresses). No navigation.

### TC-AUTH-04 · Password field show/hide toggle · P3
**Steps:** 1. Type a password. 2. Click the eye icon at the right of the field. 3. Click again.
**Expected:** Text toggles visible ↔ masked; aria-label switches "Show password" / "Hide password".

### TC-AUTH-05 · Open "Create a password / Forgot password" · P2
**Steps:** 1. On Login, click **Forgot password?** (or **Create a password**).
**Expected:** View changes to "Set your password" with an email field and **Send code** button; previous errors cleared.

### TC-AUTH-06 · Request OTP for registered email · P1
**Precondition:** Email is registered.
**Steps:** 1. On "Set your password", enter the registered email. 2. Click **Send code**.
**Expected:** Button shows "Sending…"; on success toast **"Code sent" — "Check your email for the 6-digit code."**; view changes to "Choose a new password" referencing the email; a 6-digit code is emailed.

### TC-AUTH-07 · Request OTP for unregistered email · P2
**Steps:** 1. Enter an unregistered email. 2. **Send code**.
**Expected:** Error **"That email isn't registered. Contact your administrator."**; no view change.

### TC-AUTH-08 · Complete password reset (happy path) · P1
**Precondition:** On "Choose a new password" with a valid emailed code.
**Steps:**
1. Enter the 6-digit **code** (field accepts digits only, max 6; letter-spaced display).
2. Enter **New password** ≥ 8 characters.
3. Enter matching **Confirm password**.
4. Click **Set password**.
**Expected:** Button shows "Saving…"; on success toast **"Password set" — "Sign in with your new password."**; returns to Login with green notice **"Password set. Sign in with your new password."**

### TC-AUTH-09 · Reset validation — code length · P2
**Steps:** 1. Enter a 1–5 digit code + valid passwords. 2. **Set password**.
**Expected:** Error **"Enter the full 6-digit code to continue."** Below the code field, the helper turns red while 0 < length < 6.

### TC-AUTH-10 · Reset validation — short password · P2
**Steps:** 1. Enter valid code, a 7-char password. 2. **Set password**.
**Expected:** Error **"Your new password must be at least 8 characters."** Field helper turns red.

### TC-AUTH-11 · Reset validation — mismatch · P2
**Steps:** 1. Enter valid code, new password, a different confirm. 2. **Set password**.
**Expected:** Error **"The passwords don't match. Re-enter them."** (While typing, muted hint "Passwords don't match yet." appears.)

### TC-AUTH-12 · Reset — wrong/expired code · P2
**Steps:** 1. Enter an incorrect/expired 6-digit code + valid passwords. 2. **Set password**.
**Expected:** Error **"That code is incorrect or expired. Request a new code."**

### TC-AUTH-13 · Reset navigation links · P3
**Steps:** On reset view click **Use a different email** → returns to email step. On email step click **Back to sign in** → returns to Login.
**Expected:** Fields/errors reset on each transition.

### TC-AUTH-14 · Sign in with new password · P1
**Steps:** After TC-AUTH-08, sign in with the new password.
**Expected:** Successful login.

### TC-AUTH-15 · Session persists on refresh · P1
**Steps:** 1. Sign in. 2. Press F5 / reload.
**Expected:** Remains authenticated (session restored via stored refresh token), lands on current/last screen logic (Dashboard).

### TC-AUTH-16 · Sign out · P1
**Steps:** 1. Click avatar (top-right). 2. Click **Sign out**.
**Expected:** Returns to Login; reloading keeps user on Login (token cleared).

---

# MODULE 2 — APP SHELL

### TC-SHELL-01 · Role-filtered navigation · P1
**Steps:** Sign in as each role; inspect sidebar groups: Overview, Clients, Revenue, Operations, Admin.
**Expected (examples):**
- Analyst: Dashboard, Clients, Reports only.
- Support: Dashboard, Clients, Onboarding, Reports, Support.
- Sales: Dashboard, Clients, Onboarding, Plans, Billing, Reports.
- Finance: Dashboard, Clients, Plans, Billing, Reports.
- Admin: all except Settings.
- Owner: all incl. Settings, Team, Identity & Access.
Empty groups are hidden entirely.

### TC-SHELL-02 · Navigate each screen · P1
**Steps:** Click each visible nav item in turn.
**Expected:** Content swaps; breadcrumb updates (e.g. Clients / Detail); active item highlighted with its colour; content area scrolls to top.

### TC-SHELL-03 · Collapse / expand sidebar · P2
**Steps:** 1. Click **Collapse** (bottom). 2. Hover an icon. 3. Click again to expand.
**Expected:** Labels hide, brand text hides, icons remain; hovering shows tooltip (item label); re-expands fully.

### TC-SHELL-04 · Theme toggle persistence · P2
**Steps:** 1. Click sun/moon icon in top bar. 2. Reload page. 3. Toggle via account menu (Light/Dark mode).
**Expected:** Theme flips immediately; persists after reload (stored key `sm_theme`); both toggles behave identically.

### TC-SHELL-05 · Mobile navigation · P2
**Steps:** 1. Resize to <768px. 2. Click hamburger. 3. Click scrim / a nav item.
**Expected:** Sidebar slides in over a dimmed scrim; selecting an item navigates and closes the drawer; scrim click closes it.

### TC-SHELL-06 · Account menu contents · P3
**Steps:** Click avatar.
**Expected:** Shows role name, user id, coloured role badge; items: My profile, Settings (Owner only), theme toggle, Sign out (red/danger).

### TC-SHELL-07 · Breadcrumbs accuracy · P3
**Steps:** Navigate Clients → open a client → observe crumb; go to Support → System health.
**Expected:** Crumbs read "Clients / Detail" and "Support / System health" respectively; last crumb bold.

### TC-SHELL-08 · Route guard (Forbidden/redirect) · P1
**Steps:** As a restricted role, attempt to reach a disallowed route (via state or role downgrade).
**Expected:** Either a **Forbidden** panel naming the permission, or redirect to Dashboard.

### TC-SHELL-09 · Non-functional top-bar controls · P3
**Steps:** Click the top-bar Search box and the Notifications bell.
**Expected (current build):** They render (bell shows a red dot) but have **no wired action**. Record as placeholders.

---

# MODULE 3 — DASHBOARD

### TC-DASH-01 · KPI cards render · P1
**Precondition:** Any role.
**Steps:** Open Dashboard; read the 7 KPI cards.
**Expected:** Total clients, Active, Trials, Suspended, MRR (₹ formatted), Churn (%), Trials ending — each with a coloured top border and tinted icon.

### TC-DASH-02 · Recurring revenue chart · P2
**Steps:** View the "Recurring revenue" card (header shows MRR + churn %).
**Expected:** Line chart of MRR over months. If the series is all zeros → placeholder **"Not enough history yet"**.

### TC-DASH-03 · Clients by plan donut · P3
**Expected:** Donut chart of plan mix renders.

### TC-DASH-04 · New signups bars · P3
**Expected:** Bar chart; if all-zero → "Not enough history yet".

### TC-DASH-05 · Usage alerts list + navigation · P2
**Steps:** 1. Observe "Usage alerts" (amber "N flagged" badge when non-empty). 2. Click an alert row.
**Expected:** Up to 5 rows (avatar, name, usage %, status). Usage % is **red ≥95%**, amber otherwise. Click navigates to that client's detail. If none → "No tenants over 80% usage."

### TC-DASH-06 · Recent activity · P3
**Expected:** Up to 6 rows (actor, action, target, role badge, time); empty → "No recent activity."

### TC-DASH-07 · Health panel · P3
**Expected:** Lists services with latency · uptime and status; empty → "No health data."

### TC-DASH-08 · Range selector (inert) · P2 ⚠️
**Steps:** Switch 30d / 90d / 12m.
**Expected (current build):** Selection highlights but data/charts **do not change** (fixed to last 12 months). Record as suspected defect.

### TC-DASH-09 · Reports shortcut · P3
**Steps:** Click **Reports** button.
**Expected:** Navigates to Reports.

### TC-DASH-10 · Loading / error states · P3
**Expected:** While loading shows "Loading dashboard…"; on API error shows error UI.

---

# MODULE 4 — CLIENTS (LIST)

### TC-CLI-01 · List & summary · P1
**Steps:** Open Clients.
**Expected:** Header "N clients · M schools"; table columns Client, Status, Schools, MRR, Since, actions; owners with multiple schools grouped into one row.

### TC-CLI-02 · Status filter chips · P1
**Steps:** Click All, Active, Trial, Suspended, Cancelled in turn.
**Expected:** Table filters to that status; each chip shows a live count; page resets to 1.

### TC-CLI-03 · Search · P1
**Steps:** Type a school name; then an owner email; then a phone fragment.
**Expected:** Case-insensitive filtering across name, slug, contact name/email/phone; page resets to 1; clearing restores list.

### TC-CLI-04 · Plan/tier filter · P2
**Steps:** Choose a tier from the "All plans" dropdown.
**Expected:** Only clients on that tier remain.

### TC-CLI-05 · Column sorting · P2
**Steps:** Click headers Client, Schools, MRR, Since; click each twice.
**Expected:** Sort toggles asc/desc; arrow (▲/▼) on active column; default sort MRR desc.

### TC-CLI-06 · Pagination · P2
**Precondition:** >12 owner-groups.
**Steps:** Use pager controls.
**Expected:** 12 groups/page; total matches; next/prev work; filters reset to page 1.

### TC-CLI-07 · Open single-school client · P1
**Steps:** Click a single-school row.
**Expected:** Navigates to Client Detail for that school.

### TC-CLI-08 · Expand multi-school owner · P1
**Steps:** 1. Click a multi-school row (chevron). 2. Click a nested school row.
**Expected:** Row expands to nested table (School, Status, Plan, MRR, Students usage bar, Created); nested row click opens that school's detail; chevron rotates when open; status column of parent shows a summary like "3 active · 1 trial".

### TC-CLI-09 · Row action menu · P2
**Steps:** Open "⋯" on a single and a multi row.
**Expected:** Single → "View details"; Multi → "Show schools / Hide schools"; plus "View invoices" only when `billing.view`.

### TC-CLI-10 · Onboard button gating · P1
**Steps:** Sign in as Sales (has start_trial) then Analyst (no).
**Expected:** "Onboard client" button present for Owner/Admin/Sales only; click opens Onboard wizard.

### TC-CLI-11 · Empty results · P3
**Steps:** Search a nonsense string.
**Expected:** Empty state "No clients match — Try clearing filters or a different search."

---

# MODULE 5 — CLIENT DETAIL & LIFECYCLE

### TC-CD-01 · Detail layout · P1
**Steps:** Open any client.
**Expected:** Header (name; "country · @slug · CSM"; status badge; action buttons); 4 KPI tiles (Plan, MRR, Health, Tier); cards: Owner & contact, School details, Plan & billing, Usage (bar + staff/storage/usage%), Activity.

### TC-CD-02 · Copy to clipboard · P2
**Steps:** Click copy next to Email, Phone, Address, Client ID.
**Expected:** Icon swaps copy→check; toast **"Copied"** with the copied value (kind info); reverts after ~1.5s. On failure: **"Copy failed" — "Could not copy to clipboard."**

### TC-CD-03 · Contact links · P3
**Expected:** Email is a mailto link; Phone is a tel link (present only when value exists).

### TC-CD-04 · Back to clients · P3
**Steps:** Click **Back to clients**.
**Expected:** Returns to Clients list.

### TC-CD-05 · Owner's other schools · P2
**Precondition:** Owner has >1 school.
**Steps:** View "Schools under this owner"; click a different school.
**Expected:** Lists sibling schools with a "N schools" badge; current school labelled "This school" (not clickable); clicking another loads it.

**Lifecycle buttons by current status (shown only if permitted):**

| Status | Buttons |
|---|---|
| trial | Activate · Hold school · Deactivate · Cancel · Force change plan |
| active | Hold school · Deactivate · Cancel · Force change plan |
| hold | Release hold · Deactivate · Cancel |
| deactivated | Reactivate · Cancel |
| suspended | Reinstate · Reactivate · Cancel |
| cancelled | Start trial |

Every action opens a confirm dialog; buttons disable while a mutation runs; any failure → toast **"Action failed"** with API message.

### TC-CD-06 · Activate (trial→active) · P1
**Precondition:** Role with `clients.activate`; client is trial.
**Steps:** 1. Click **Activate**. 2. In dialog "Activate this client?" read the body "Creates an active subscription, generates an invoice, and emails the school contact." 3. Click **Activate**.
**Expected:** Toast **"Client activated" — "Subscription + invoice created; billing email sent if contact email is set."**; header status → Active; action set updates.

### TC-CD-07 · Hold school (active/trial→hold) · P1
**Steps:** 1. **Hold school** → dialog "Put this school on hold?" → **Hold school**.
**Expected:** Info toast **"School on hold" — "Access locked until hold is released."**; status → hold.

### TC-CD-08 · Release hold (hold→active) · P1
**Steps:** On a held school, **Release hold** → confirm "Release hold?" → **Release hold**.
**Expected:** Toast **"Hold released" — "School is active again."**; status → active.

### TC-CD-09 · Deactivate · P1
**Steps:** **Deactivate** → red dialog "Deactivate this school?" → **Deactivate school**.
**Expected:** Info toast **"School deactivated" — "Access revoked until reactivated."**; status → deactivated.

### TC-CD-10 · Reactivate · P1
**Steps:** On deactivated school, **Reactivate** → confirm → **Reactivate**.
**Expected:** Toast **"School reactivated" — "Access restored."**; status → active.

### TC-CD-11 · Cancel subscription · P1
**Steps:** **Cancel** → red dialog "Cancel this subscription?" ("…cancelled at period end. Data retained 90 days.") → **Cancel subscription**.
**Expected:** Info toast **"Subscription cancelled" — "Cancels at period end."**; status → cancelled.

### TC-CD-12 · Start trial (cancelled→trial) · P1
**Steps:** On cancelled client, **Start trial** → confirm "Start a new trial?" → **Start trial**.
**Expected:** Toast **"Trial started" — "14-day trial is now active."**; status → trial.

### TC-CD-13 · Reinstate (suspended) · P1
**Precondition:** Suspended client; role Owner/Admin/Finance.
**Steps:** **Reinstate** → confirm "Reinstate this client?" → **Reinstate**.
**Expected:** Toast **"Client reinstated" — "Access restored; billing ensured."**

### TC-CD-14 · Force change plan · P1
**Precondition:** trial/active; role with `clients.change_plan`.
**Steps:** 1. Click **Force change (no payment)**. 2. Modal "Force change plan"; current plan tagged "· current". 3. Confirm **Update plan** is disabled while the current plan is selected. 4. Select a **different** plan. 5. Click **Update plan**.
**Expected:** "Update plan" enables only after picking a different plan; on success toast **"Plan updated" — "The subscription plan was changed."**; modal closes. **Cancel** closes without change.

### TC-CD-15 · Delete empty school (Owner only) · P1
**Precondition:** Owner; school has 0 students AND 0 staff.
**Steps:** 1. Click **Delete**. 2. Dialog "Delete this school permanently?" ("Only allowed when there are no students and no staff/teachers…cannot be undone.") 3. Click **Delete school**.
**Expected:** Toast **"School deleted" — "<name> was removed."**; navigates back to Clients list.

### TC-CD-16 · Delete hidden when not eligible · P1
**Steps:** View **Delete** button on (a) a school with students/staff, (b) as non-Owner.
**Expected:** Button not rendered in either case.

### TC-CD-17 · Lifecycle permission gating matrix · P1
**Steps:** For each role, open clients in each status and record visible buttons.
**Expected:** Matches the RBAC matrix — e.g. Support sees no lifecycle buttons; Sales sees Start trial / Force change but not Hold/Deactivate/Cancel/Suspend; Finance sees Activate/Reinstate but not Suspend/Cancel; Analyst sees none.

### TC-CD-18 · Lifecycle error handling · P2
**Steps:** With backend forced to fail, confirm any lifecycle action.
**Expected:** Error toast **"Action failed"** with the API message; status unchanged.

### TC-CD-19 · Usage & Activity states · P3
**Expected:** Usage card shows bar + staff/storage/usage% (loading/error handled); Activity lists rows or "No activity yet".

---

# MODULE 6 — ONBOARD WIZARD

Left rail: 5 steps; completed steps clickable, current/future not. Top **Cancel** → Clients.

### TC-OW-01 · Step 1 school name auto-slug · P1
**Steps:** 1. In **School name** type "Sunrise Public School". 2. Observe **Workspace slug** auto-fills (e.g. `sunrise-public-school`). 3. Edit slug manually.
**Expected:** Slug lowercases, non-alphanumerics → hyphens, trimmed; prefix shows `catre.app/`; manual edit retained.

### TC-OW-02 · Step 1 other fields · P2
**Steps:** Choose **City** (e.g. Mumbai, MH), **School size** (e.g. 500–1,200), optional **Address**.
**Expected:** City defaults "Mumbai, MH"; size defaults "Select…".

### TC-OW-03 · Step 1 validation · P1
**Steps:** Clear name and/or slug → **Continue**.
**Expected:** "School name is required" and/or "Slug is required"; cannot advance.

### TC-OW-04 · Step 2 admin contact validation · P1
**Steps:** 1. Leave name empty → Continue → "Admin name is required". 2. Enter name, invalid email `abc@xyz` → Continue → "Valid email required". 3. Enter `admin@school.in` → passes. Optional phone, CSM.
**Expected:** Errors as listed; CSM dropdown lists active Sales/Admin/Owner teammates; defaults "Unassigned".

### TC-OW-05 · Step 3 plan & payment selection · P1
**Steps:** 1. Select a plan card. 2. Select a payment method (Start on trial / Pay offline / Pay online).
**Expected:** Validation: no plan → "Select a plan"; no method → "Select a payment method".

### TC-OW-06 · Step branch skip · P1
**Steps:** 1. Choose **Pay offline** or **Pay online** → Continue.
**Expected:** Wizard **skips Trial length** and goes straight to **Review**; pressing **Back** from Review returns to Plan & payment.

### TC-OW-07 · Step 4 trial length (trial only) · P2
**Steps:** 1. Choose **Start on trial** → Continue. 2. Pick a preset chip (7/14/30/60/90/365). 3. Type a custom number.
**Expected:** Default 14; active chip highlighted; custom field accepts digits only; empty = 0.

### TC-OW-08 · Step 5 review accuracy · P2
**Steps:** Review the summary.
**Expected:** Shows City, Address, Admin (name · email), CSM, Plan (name · price/mo), Payment line (Trial · N days / Offline / Razorpay), First charge; info box "An invite email will be sent to the admin to complete setup."

### TC-OW-09 · Submit trial · P1
**Steps:** On Review (trial), click **Create client**.
**Expected:** Toast **"Client created" — "<name> is now in trial."**; navigates to Clients.

### TC-OW-10 · Submit offline · P1
**Steps:** On Review (offline), click **Create & request offline payment**.
**Expected:** Toast **"Client created · offline payment pending"** ("…Confirm payment under Billing → Upgrade requests, then Approve to activate."); navigates to Billing.

### TC-OW-11 · Submit online (Razorpay) · P1
**Steps:** On Review (online), click **Create & collect payment**.
**Expected (branch outcomes):**
- Razorpay checkout opens.
- Payment success → toast **"Payment received"** ("Approve under Billing → Upgrade requests to activate…").
- Checkout dismissed → info toast **"Payment not completed" — "Checkout closed — payment is still pending (not paid)."**
- Script fails / not configured → info toast **"Payment not done"** (payment still pending; not treated as paid).
- Confirm failure → **"Payment confirm failed"** with message.
- After any outcome → navigates to Billing.

### TC-OW-12 · Create error · P2
**Steps:** Force backend to reject create; submit.
**Expected:** Toast **"Could not create client"** with API message; remains on wizard.

### TC-OW-13 · Wizard navigation · P3
**Steps:** Use **Back**, **Cancel**, and click a completed step in the rail.
**Expected:** Back steps correctly (handles skip); Cancel → Clients; completed-step click jumps back; future steps not clickable.

---

# MODULE 7 — ONBOARDING (KANBAN)

### TC-ONB-01 · Board layout · P1
**Steps:** Open Onboarding (role with `onboarding.view`).
**Expected:** 4 columns — Lead, Trial, Onboarding, Active — each with coloured dot, title, count badge; cards grouped by stage; empty columns show "Drop here".

### TC-ONB-02 · Read-only mode · P1
**Steps:** Sign in as Support (view but not manage).
**Expected:** Description "Read-only view of the onboarding pipeline."; cards not draggable; no drag handle; checklist items not toggleable.

### TC-ONB-03 · Drag card between stages · P1
**Precondition:** Role with `onboarding.manage`.
**Steps:** 1. Drag a card from Lead to Trial. 2. Drop on the same column (no move).
**Expected:** Target column highlights on drag-over; valid drop → toast **"Moved to Trial" — "Pipeline updated."**; same-column drop = no-op; failure → **"Move failed."**

### TC-ONB-04 · Checklist expand & toggle · P2
**Steps:** 1. Click **Checklist** on a card. 2. (manage) tick an item. 3. Untick it.
**Expected:** List expands (label "Hide checklist"); checkbox fills/empties; progress bar + "done/total" update (bar green at 100%). Non-managers can expand but toggles are ignored. Failure → **"Update failed."**

### TC-ONB-05 · New client entry · P2
**Steps:** Click **New client** (visible with `clients.start_trial`).
**Expected:** Opens Onboard wizard.

### TC-ONB-06 · Card content · P3
**Expected:** Avatar + name, value "₹.../mo", contact block (if present), progress, owner avatar + first name, "<age>d" days in pipeline.

---

# MODULE 8 — PLANS CATALOG

Reached via **Plans** nav (plansOnly) or Billing → Plans. Edit needs `plans.manage`.

### TC-PLN-01 · Filter tabs · P2
**Steps:** Click All / Published / Unpublished / New client / Existing client / Exclusive.
**Expected:** Grid filters; each tab shows count badge.

### TC-PLN-02 · Card display · P3
**Expected:** Status badge (green Published / amber Draft), audience badge (Public/New schools/Exclusive), "Metered" badge for per-student plans, price, offer chip, limits (students/staff/storage), first 4 features + "+N more"; draft cards have amber border.

### TC-PLN-03 · Read-only gating · P1
**Steps:** Sign in as Sales (view only).
**Expected:** No "New plan" button; no Publish/Edit on cards; helper "Read-only — Finance/Owner edit plans."

### TC-PLN-04 · Publish draft · P1
**Precondition:** manage; a draft plan.
**Steps:** Click **Publish** on a draft card.
**Expected:** Info toast **"Plan published"** with plan name; badge → green Published; border changes; filter counts update.

### TC-PLN-05 · Unpublish · P1
**Steps:** Click **Unpublish** on a published card.
**Expected:** Info toast **"Plan unpublished"**; badge → amber Draft.

### TC-PLN-06 · Create plan · P1
**Steps:** Click **New plan** → modal → fill valid fields → **Save plan**.
**Expected:** Toast **"Plan created"** with name; modal closes; card appears in grid.

### TC-PLN-07 · Edit plan · P1
**Steps:** Click **Edit** on a card → change fields → **Save plan**.
**Expected:** Toast **"Plan saved"** ("· published" or "· draft").

### TC-PLN-08 · Create/Edit error · P2
**Steps:** Force backend error on save.
**Expected:** Toast **"Error"** with API message; modal stays open.

---

# MODULE 9 — PLAN EDIT MODAL

Validation appears only **after first Save**, then updates live.

### TC-PEM-01 · Required: name & band · P1
**Steps:** Leave Plan name and Size band empty → **Save plan**.
**Expected:** Both show red border + "Required"; modal stays open.

### TC-PEM-02 · Flat pricing validation · P2
**Steps:** Set Pricing = Flat monthly; Price = 0 → Save.
**Expected:** "Greater than 0" on Price.

### TC-PEM-03 · Per-student pricing validation · P2
**Steps:** Set Pricing = Per-student; set ₹/student = 0 and/or Min students = 0 → Save.
**Expected:** "Greater than 0" on each zero field.

### TC-PEM-04 · Offer toggle & validation · P2
**Steps:** 1. Toggle the **offer switch** on (label "Offer attached"; defaults label "Launch offer", 20%). 2. Clear the offer label and set % = 0 → Save.
**Expected:** "Required" on label, "Greater than 0" on discount; toggling off removes the offer fields.

### TC-PEM-05 · Availability & visibility chips · P3
**Steps:** Set Audience (Public/New only/Exclusive) and Visibility (Published/Draft).
**Expected:** Active chip highlighted; values stored.

### TC-PEM-06 · Limits all > 0 · P1
**Steps:** Set any of Students/Staff/Storage(GB) = 0 → Save.
**Expected:** "Greater than 0" on each zero limit; plan cannot save until all three are > 0.

### TC-PEM-07 · School modules — bulk add/clear · P2
**Steps:** 1. Click **+ Silver**, **+ Gold**, **+ Platinum** (each adds that tier's modules, union). 2. Click **Clear**.
**Expected:** "N selected" badge updates; Clear empties all modules.

### TC-PEM-08 · Module checkbox toggle · P2
**Steps:** Tick/untick a feature checkbox.
**Expected:** Cell highlights when selected; count updates.

### TC-PEM-09 · Per-module tier selector incl. toggle-off · P1
**Steps:** 1. On a module, click **Gold** → module selected at Gold. 2. Click **Gold** again (already active).
**Expected:** First click selects at Gold; clicking the **already-active** tier **removes** the module entirely. Clicking a different tier changes its unlock tier.

### TC-PEM-10 · Save derived tier · P2
**Steps:** Select modules spanning tiers; Save valid plan.
**Expected:** Plan saves; backend tier = highest selected module tier (defaults silver when none).

### TC-PEM-11 · Cancel discards · P3
**Steps:** Make changes → **Cancel**.
**Expected:** Modal closes; no changes saved; no toast.

### TC-PEM-12 · No premature errors · P2
**Steps:** Open modal; before clicking Save, inspect fields.
**Expected:** No red borders/errors until first Save; after Save, errors clear live as fixed.

---

# MODULE 10 — BILLING

### TC-BIL-01 · Tab set & default · P1
**Steps:** Open Billing as a fully-permissioned user; then as Sales (billing.view) vs Finance.
**Expected:** Tabs = Upgrade requests, Plans, Subscriptions, Invoices (permission-filtered). Default = first available (full user lands on **Upgrade requests**). Clicking tabs swaps content.

### TC-BIL-02 · Plans-only mode · P2
**Steps:** Open **Plans** from the nav (not via Billing).
**Expected:** No tab bar; title "Plans", description "Care plans — pricing, offers and publishing."; Plans catalog renders directly; no past-due banner.

### TC-BIL-03 · Past-due banner · P2
**Precondition:** ≥1 past-due invoice.
**Steps:** 1. View a non-Plans tab. 2. Click **Review**. 3. Switch to Plans tab.
**Expected:** Red banner "**N invoices** are past due across M clients."; **Review** → Invoices tab; banner hidden on Plans tab, reappears on leaving it.

## Subscriptions tab
### TC-BIL-04 · Subscriptions table · P2
**Expected:** Columns Client, Plan (tier-coloured badge), Status, Current period (with "Nd left/today/ended"), Next charge ("₹…/ mo" or "—"); empty → "No subscriptions."
### TC-BIL-05 · Row → client · P2
**Steps:** Click a subscription row.
**Expected:** Navigates to that tenant's client detail.

## Invoices tab
### TC-BIL-06 · Invoice filters · P2
**Steps:** Click All / Paid / Open / Past due.
**Expected:** Filters with counts; past-due due-dates render red.
### TC-BIL-07 · Download PDF (button) · P2
**Steps:** Click **PDF** on a row.
**Expected:** Toast **"Invoice downloaded"** with tenant name; file downloads. Failure → **"Download failed."**
### TC-BIL-08 · Download PDF (menu) · P3
**Steps:** ⋯ → **Download PDF**.
**Expected:** Same as above.
### TC-BIL-09 · Email invoice · P2
**Steps:** ⋯ → **Email to school**.
**Expected:** Toast **"Invoice emailed" — "Sent to school owner contact."**; failure → **"Send failed."**
### TC-BIL-10 · Mark as paid · P1
**Precondition:** `billing.manage_invoice`; invoice open/past_due.
**Steps:** ⋯ → **Mark as paid**.
**Expected:** Toast **"Invoice marked paid"** with invoice id; status → paid; "Mark as paid" disappears; "Refund" becomes eligible; counts update.
### TC-BIL-11 · Mark as paid gating · P1
**Steps:** As a role without `billing.manage_invoice`, or on an already-paid invoice, open the menu.
**Expected:** "Mark as paid" not shown.
### TC-BIL-12 · Refund · P1
**Precondition:** `billing.refund` (Owner/Finance); invoice is paid.
**Steps:** 1. ⋯ → **Refund**. 2. Confirm dialog "Refund this invoice?" ("A full refund of ₹… will be issued to <tenant>. This is logged."). 3. **Issue refund**.
**Expected:** Info toast **"Refund issued"** ("₹… to <tenant>"). Failure → **"Error."** Cancel closes with no action.
### TC-BIL-13 · Refund gating · P1
**Steps:** On a non-paid invoice, or without `billing.refund`.
**Expected:** "Refund" not shown.
### TC-BIL-14 · Action clicks don't navigate · P3
**Steps:** Click any invoice action.
**Expected:** Row does not navigate (event isolated).

## Upgrade Requests tab
### TC-BIL-15 · Request filters · P2
**Steps:** Click All / Offline / Paid online / Awaiting pay / Approved / Rejected.
**Expected:** Filters with counts; Mode badge shows Razorpay (online) / Offline.
### TC-BIL-16 · Approve · P1
**Precondition:** Request is pending_offline or paid_pending_approval; `billing.view`.
**Steps:** 1. **Approve**. 2. Dialog "Approve plan upgrade" ("Activate <plan> for <tenant>? This updates the school plan, subscription, and marks the invoice paid."). 3. **Approve & activate**.
**Expected:** Toast **"Plan activated"** ("<tenant> → <plan>"); dialog closes. Failure → **"Approve failed."**
### TC-BIL-17 · Reject · P1
**Steps:** 1. **Reject**. 2. Dialog "Reject upgrade request" → **Reject**.
**Expected:** Toast **"Request rejected"** with tenant. Failure → **"Reject failed."**
### TC-BIL-18 · Non-actionable rows · P2
**Steps:** View rows in pending_payment / approved / rejected.
**Expected:** No Approve/Reject buttons.
### TC-BIL-19 · Double-submit guard · P3
**Steps:** Click Approve/Reject and watch buttons during the pending call.
**Expected:** Both buttons disabled until the mutation resolves.

---

# MODULE 11 — REPORTS

### TC-RPT-01 · KPIs · P2
**Expected:** ARR (annualized), Avg revenue/client (ARPA), Net growth (%), Gross churn (%).
### TC-RPT-02 · Charts & table · P3
**Expected:** Revenue trend (line; "Not enough history yet" if all-zero), Revenue by plan (donut), Plan performance table (plan, clients, MRR, share %, bar).
### TC-RPT-03 · Export CSV success · P1
**Steps:** Click **Export CSV**.
**Expected:** Button shows "Exporting…"; browser downloads **`catre-clients.csv`**; toast **"Export ready."**
### TC-RPT-04 · Export CSV error · P2
**Steps:** Force failure, click Export.
**Expected:** Toast **"Export failed" — "Could not download the CSV."**
### TC-RPT-05 · Range selector (inert) · P2 ⚠️
**Steps:** Switch 90d / 12m / YTD.
**Expected (current build):** Highlights only; data unchanged. Record as suspected defect.

---

# MODULE 12 — SUPPORT (TICKET LIST)

### TC-SUP-01 · Filters · P1
**Steps:** Click Open / All / Resolved / Closed.
**Expected:** Open = open+pending; counts shown; default = Open; list re-filters.
### TC-SUP-02 · Search · P2
**Steps:** Type text.
**Expected:** Filters by subject + tenant name (case-insensitive), combined with status filter.
### TC-SUP-03 · Row contents · P3
**Expected:** Priority badge, subject, short id, tenant, message count, status badge, assignee (or faint "Unassigned"), relative updated time ("Xm"/"Xh"/date).
### TC-SUP-04 · Open ticket · P1
**Steps:** Click a row.
**Expected:** Ticket Detail replaces the list.
### TC-SUP-05 · Health sidebar & navigation · P2
**Steps:** Observe health dot; click **Full health** and the header **System health**.
**Expected:** Dot green if all operational else amber; both buttons → Health screen.
### TC-SUP-06 · Empty state · P3
**Expected:** "No tickets — Nothing matches this filter."

---

# MODULE 13 — TICKET DETAIL

### TC-TKT-01 · Layout & navigation · P2
**Expected:** Priority badge, id, subject; **All tickets** back; **Open client** → client detail; thread with Agent/Client role badges; Details panel (status, client, created, assignee).
### TC-TKT-02 · Reply success · P1
**Precondition:** `support.manage`.
**Steps:** 1. Confirm **Send reply** is disabled with empty text. 2. Type a reply. 3. Click **Send reply**.
**Expected:** Toast **"Reply sent"**; textarea clears; new message appears in thread. Failure → **"Reply failed"** with message.
### TC-TKT-03 · Read-only (no manage) · P1
**Steps:** Sign in as Sales/Finance/Analyst.
**Expected:** No composer; lock note "Your role can view but not reply."
### TC-TKT-04 · Change status · P1 ⚠️
**Steps:** Click status chips open/pending/resolved/closed.
**Expected:** Info toast **"Status → <status>"**; Details status badge updates. ⚠️ On backend failure there is **no error toast** (UI appears to do nothing) — record as a negative-path risk.
### TC-TKT-05 · Assign ticket · P1 ⚠️
**Steps:** Choose an assignee (active support/admin/owner) or Unassigned.
**Expected:** Toast **"Assigned"** with the name (or "Unassigned"); Assignee row updates. ⚠️ No error toast on failure.

---

# MODULE 14 — SYSTEM HEALTH

### TC-HLT-01 · Panel & back · P2
**Steps:** Open from Support; click **Support** back.
**Expected:** Lists services (name, latency · uptime, status badge); empty → "No health data"; back → Support.

---

# MODULE 15 — TEAM

Owner can assign any role; Admin cannot grant **Owner**. Manage needs `team.manage`.

### TC-TEAM-01 · Roster, filters, search · P1
**Steps:** Use role filter chips (with counts) and search (name/email/id/employee_id).
**Expected:** Table filters; columns: member (avatar/name/email/phone), employee id, docs chip, role badge, status badge, joined date.
### TC-TEAM-02 · Read-only mode · P1
**Steps:** View as a role with team.view but not manage.
**Expected:** No "Add member", no row menu, no delete-doc.
### TC-TEAM-03 · Add member success · P1
**Steps:** **Add member** → fill modal (see Module 16) → **Create member**.
**Expected:** Toast **"Member created"** ("<name> · <employee_id or —>[ · N document(s)] · OTP ready."); modal closes; member appears. Failure → **"Create failed."**
### TC-TEAM-04 · Docs expand/download · P2
**Steps:** 1. Click the Docs chip. 2. **Download** a doc.
**Expected:** Sub-row expands (or "No documents yet."); download starts. Failure → **"Download failed."**
### TC-TEAM-05 · Delete doc (manage) · P2
**Steps:** In expanded docs, click **Delete**.
**Expected:** Toast **"Document removed"** with file name. Failure → **"Delete failed."**
### TC-TEAM-06 · Add doc via menu (manage) · P2
**Steps:** Row menu → **Add document** → pick a file (.pdf/.doc/.docx/image).
**Expected:** Toast **"Document added"** with file name. Failure → **"Upload failed"** / **"Could not read file."**
### TC-TEAM-07 · Change role (manage) · P1
**Steps:** Row menu → **Change role** → pick a role chip.
**Expected:** Inline chips appear; selecting → toast **"Role updated" — "<name> is now <Role>."**; role badge updates. As **Admin**, no Owner chip is offered.
### TC-TEAM-08 · Deactivate/Reactivate (manage) · P1
**Steps:** Row menu → **Deactivate** (then **Reactivate**).
**Expected:** Toast **"Deactivated"** / **"Reactivated"** with name; status badge flips. Failure → **"Update failed."**
### TC-TEAM-09 · Empty state · P3
**Expected:** "No teammates" with role-appropriate subtext.

---

# MODULE 16 — INVITE / CREATE MEMBER MODAL

(Reused by Team and Identity. Default role Sales; Admin actors cannot pick Owner.)

### TC-INV-01 · Required name · P1
**Steps:** Leave Full name empty → **Create member**.
**Expected:** "Name is required"; submit aborts.
### TC-INV-02 · Email regex · P1
**Steps:** Enter `a@b` → Create (fails); enter `a@b.c` (passes).
**Expected:** "Valid email required" for `a@b`; accepted for `a@b.c`.
### TC-INV-03 · Required employee ID · P1
**Steps:** Leave Employee ID empty → Create.
**Expected:** "Employee ID is required."
### TC-INV-04 · Role required · P2
**Steps:** (If deselectable) ensure a role is chosen; role desc shows under chips.
**Expected:** "Pick a role" if none/invalid.
### TC-INV-05 · Photo add/remove · P2
**Steps:** **Add photo** (image) → preview shows; **Remove** clears. During processing button shows "Processing…".
**Expected:** Preview updates; bad file → red photo error; Create disabled while photo busy.
### TC-INV-06 · Documents cap 8 · P2
**Steps:** Choose a label, **Add documents** repeatedly past 8.
**Expected:** Rows list with Remove each; button disables at 8; hint "PDF / Word / image · max 8 · 2.5MB each".
### TC-INV-07 · Create disabled while busy · P3
**Expected:** **Create member** disabled while pending/photo-busy/doc-busy (label "Creating…").
### TC-INV-08 · Cancel resets · P3
**Steps:** Fill fields → **Cancel** (or close).
**Expected:** All fields/errors/inputs reset; modal closes.

---

# MODULE 17 — IDENTITY & ACCESS

Owner targets all roles; Admin cannot target Owner. Manage needs `identity.manage`.

### TC-ID-01 · Tabs & role filter · P2
**Steps:** Switch Users / Roles / Access matrix; change the role filter dropdown.
**Expected:** Tab content changes; role filter affects Users rows, Roles cards shown, and Matrix column highlight.
### TC-ID-02 · Add identity · P1
**Precondition:** manage; Users tab.
**Steps:** **Add identity** → modal → create.
**Expected:** Toast **"Identity created"** ("<name> · <Role>"); audit line "Invited <email> as <role>"; modal closes. Failure → **"Invite failed."**
### TC-ID-03 · Users search & table · P2
**Steps:** Search by id/employee id/name/email.
**Expected:** Columns: ID (short, full on hover), Employee ID, Member, Role, Status, Last login.
### TC-ID-04 · Change role (manage) · P1
**Steps:** Row menu → pick a role (current marked ✓).
**Expected:** Toast **"Role updated"** ("<name> → <Role>"); audit "Set <email> role to <role>." Failure → **"Update failed."**
### TC-ID-05 · Deactivate/Reactivate (manage) · P1
**Steps:** Row menu → Deactivate/Reactivate.
**Expected:** Toast + audit "Deactivated/Reactivated <email>."
### TC-ID-06 · Roles tab · P2
**Expected:** Read-only cards per role: color dot, name, "<n> users", description, grouped permissions (reflecting local matrix preview edits).
### TC-ID-07 · Access matrix toggle (preview-only) · P1 ⚠️
**Steps:** 1. Select a specific role. 2. Tick **"Only permissions this role has"** (disabled when "All roles"). 3. Click a matrix cell to toggle.
**Expected:** Cell flips ✓/—; toast **"Granted (preview)"** / **"Revoked (preview)"** with "<perm label> · <Role>"; audit line appended; **Roles-tab cards reflect it**. ⚠️ KEY: this does **NOT** change live `can()` access (verify the feature does not actually unlock). Cells disabled when not manage.
### TC-ID-08 · Audit log · P3
**Expected:** "Recent changes" card lists up to 20 recent entries (invites, role changes, status toggles, matrix flips).

---

# MODULE 18 — RBAC CROSS-ROLE REGRESSION

For each role, sign in and verify both layers: (1) nav/routes hidden, (2) deep-link blocked (Forbidden/redirect).

### TC-RBAC-01 · Owner · P1 — full access incl. Team, Settings, Identity, delete client, refunds, plan config.
### TC-RBAC-02 · Admin · P1 — lifecycle, billing, support, onboarding, plans, team, identity; NO delete client, NO grant Owner, NO Settings.
### TC-RBAC-03 · Support · P1 — view clients, full tickets; NO money, NO lifecycle, NO team/identity/plan manage.
### TC-RBAC-04 · Sales · P1 — start trial, onboarding manage, change plan, billing read-only; NO suspend/cancel/refund, NO ticket reply.
### TC-RBAC-05 · Finance · P1 — plans, subscriptions, invoices, refunds, activate/reinstate; NO suspend/cancel, NO team, NO onboarding.
### TC-RBAC-06 · Analyst · P1 — Dashboard + Reports (+ Clients view) only; NO actions anywhere.

---

# APPENDIX — KNOWN BEHAVIORS TO CONFIRM (possible defects)

| # | Module | Behavior | Verify |
|---|---|---|---|
| 1 | Dashboard | Range 30d/90d/12m is inert | Should it refetch? |
| 2 | Reports | Range 90d/12m/YTD is inert | Should it refetch? |
| 3 | Ticket Detail | Status change has no error toast | Backend-fail path silent |
| 4 | Ticket Detail | Assignee change has no error toast | Backend-fail path silent |
| 5 | App shell | Search box + Notifications bell not wired | Placeholders only |
| 6 | Plan Edit | All 3 limits must be > 0 to save | Confirm intended |
| 7 | Plan Edit | Clicking the active module tier removes the module | Non-obvious UX |
| 8 | Identity | Access matrix edits are preview-only | Never affect live `can()` |

---

**Totals:** 18 modules · ~150 detailed test cases · 8 behaviors to confirm.
