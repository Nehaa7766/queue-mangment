# Commercialization (Phase 10)

What the platform side of QueueCare does today, what it deliberately does
not do yet, and the decisions needed before charging clinics. PHASES.md
Phase 10 says to start this work only after the pilot meets its success
criteria; the code below is ready for that moment, not a reason to skip it.

## What is built

| Area | Where | Notes |
|---|---|---|
| Super admin panel | `/super-admin/*` | Dashboard, clinics, users, plans and subscriptions, billing overview, activity log, support, platform settings. Super admins only. |
| Clinic approval | `/super-admin/clinics`, dashboard | New sign-ups wait as **Pending approval** until a super admin approves them. Active clinics can be **suspended**: staff lose access and the public queue page goes offline. Nothing is deleted. |
| Self-service sign-up | `/signup` | Three steps: clinic (name, public address, time zone), first service, admin account. Creates everything in one transaction. Rate-limited per client address. |
| Subscriptions | `/super-admin/subscriptions` | Plan, status (Trial, Active, Past due, Cancelled), trial end and period end, all set by hand. |
| Billing overview | `/super-admin/billing` | Monthly recurring revenue, revenue at risk and trial pipeline, computed from plans. **Not money received.** |
| Support | `/support` (clinic staff), `/super-admin/support` | Staff open tickets for their clinic; super admins move them Open → In progress → Resolved. |
| Platform settings | `/super-admin/settings` | `signupsEnabled` (switch public sign-up off) and `defaultTrialDays` (trial length for new sign-ups, 90 by default). |
| Audit | `platform_audit_events`, `/super-admin/activity` | Every super admin change and every sign-up is recorded with who did it. |

Seed data: one plan, **Pilot** (`pilot`, ₹0), and the demo clinic on a 90-day
trial. Self-service sign-ups always start on `pilot`.

## What is not built yet

- **Taking payments.** No payment provider, checkout, invoices, receipts,
  GST details or refunds. Subscription status is changed by hand.
- **Enforcing plan limits.** `plans.max_staff` and `plans.max_services` are
  stored but not checked anywhere.
- **Automatic trial expiry.** Nothing moves a clinic from Trial to Past due
  or suspends it when a trial or period ends.
- **Emails for approval.** New clinics aren't emailed when approved; tell
  them by phone or email for now. A `clinic.approved` outbox event would plug
  into the Phase 8 email worker.
- **Multi-branch clinics and advanced analytics** (PLAN.md §4 keeps these
  out until customers ask).

## Decisions you need to make

1. **Plans and prices.** How many tiers, what each costs per month, and what
   separates them (staff seats, services, branches, SMS/WhatsApp later).
   Add each as a row in `plans`; prices are stored in paise.
2. **Trial length.** 90 days today. Change it in platform settings; it only
   affects new sign-ups.
3. **Approval rules.** Who approves new clinics, what you check (a real
   clinic, a working phone number), and how fast. The sign-up page promises
   "usually within one working day".
4. **Payment provider** (see below).
5. **Tax.** Whether you charge GST, at what rate, and what invoices must
   show. Confirm with your accountant.
6. **What happens on non-payment.** How long a clinic stays Past due before
   it is suspended, and what staff see meanwhile.

## Payment provider options for India

Both options below are mainstream; confirm current pricing, onboarding
requirements and recurring-payment support directly with each provider
before choosing.

| | Razorpay | Stripe |
|---|---|---|
| Fit | Built for Indian businesses; INR settlement to an Indian bank account | Strong global product and API; useful if you'll bill clinics outside India |
| Payment methods | UPI (including UPI AutoPay), cards, net banking, wallets | Cards and other methods; check which Indian methods your account gets |
| Subscriptions | Subscriptions API with plans and recurring mandates | Stripe Billing with plans, invoices and customer portal |
| Onboarding | Indian entity, PAN, bank account and KYC | Availability of new Indian accounts has varied; check before planning around it |
| Things to check | Fees per method, settlement time, GST invoicing support | Same, plus cross-border rules if billing in INR from India |

Other Indian gateways (for example Cashfree or PayU) are also worth a quote.
Whichever you pick, recurring payments in India follow RBI e-mandate rules
(pre-debit notifications and extra authentication above a limit), so expect
some renewals to need customer action.

**How it would plug in:** keep `subscriptions` as the source of truth, store
the provider's customer and subscription IDs on it, and update `status` and
`current_period_end` from the provider's webhooks (verified signatures,
idempotent handling). The billing overview then shows real figures.

## Legal and privacy gate (PLAN.md §13)

Before taking the first paying clinic, review with qualified counsel:

- Applicable Indian data-protection law, including the Digital Personal
  Data Protection Act, 2023 and its rules, and what it means for patient
  names and staff accounts.
- Your role versus the clinic's: who decides what patient data is collected
  (the clinic) and who processes it for them (QueueCare). This drives the
  contract.
- Terms of service, privacy policy and a data processing agreement for
  clinics.
- Data retention and deletion (Phase 9 sets the retention job), breach
  notification and incident response.
- Consumer and tax obligations for subscriptions (invoices, refunds,
  cancellation).

## Onboarding a new clinic

Platform side:

- [ ] Sign-up arrives as **Pending approval** on the dashboard.
- [ ] Check the clinic is real (name, address, phone) and contact the admin.
- [ ] Approve it on its clinic page.
- [ ] Set the subscription: plan, status and dates.
- [ ] Tell the admin they can sign in.

Clinic side (once approved, using the clinic admin panel):

- [ ] Add services and doctors, and set opening hours.
- [ ] Invite reception and doctors.
- [ ] Print the QR poster and place it at reception.
- [ ] Do a test run: join from a phone, call, start and complete.
- [ ] Go live.

## Technical notes

- **Pending versus suspended.** `clinics.status` has only `ACTIVE` and
  `INACTIVE`. A clinic is shown as pending when it is inactive and its latest
  platform audit action is `clinic.signed_up`; otherwise inactive means
  suspended. A dedicated status (or an `approved_at` column) would make this
  explicit.
- **Rate limits** on sign-up (5 per hour) and the address check (60 per
  minute) are in memory, so they only hold on a single app instance
  (`src/lib/rate-limit.ts`).
- **Code:** `src/features/platform/` (clinics, users, subscriptions, support,
  settings, billing, audit), `src/features/onboarding/` (sign-up),
  `src/app/(platform-admin)/`, `src/app/(onboarding)/`,
  `src/app/api/platform/`, `src/app/api/onboarding/`, `src/app/api/support/`.
