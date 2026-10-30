-- Development seed: one demo clinic, three services, one user per role,
-- and today's open queue for each service. Safe to run more than once.
--
-- Plain SQL (run with `prisma db execute`) so it needs no TypeScript runner.
-- IDs are fixed so tests and bookmarks stay stable across re-seeds.
-- Every seeded user signs in with the password "queuecare-dev" (development only).

BEGIN;

-- Demo accounts have a published password: never seed anything but the two
-- local databases (docs/SECURITY_REVIEW.md, finding 2).
DO $guard$
BEGIN
  IF current_database() NOT IN ('queuecare_dev', 'queuecare_test') THEN
    RAISE EXCEPTION 'Refusing to seed %: demo accounts are for local databases only.', current_database();
  END IF;
END $guard$;

INSERT INTO "clinics" ("id", "name", "slug", "timezone", "address", "phone", "updated_at")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Demo Clinic',
  'demo-clinic',
  'Asia/Kolkata',
  '12 MG Road, Pune',
  '+91 20 0000 0000',
  now()
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "timezone" = EXCLUDED."timezone",
  "updated_at" = now();

INSERT INTO "services" ("id", "clinic_id", "name", "description", "token_prefix", "estimated_duration_minutes", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'General', 'General consultation', 'A', 10, now()),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Pediatrics', 'Children''s consultation', 'B', 15, now()),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Dental', 'Dental check-up', 'C', 20, now())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "token_prefix" = EXCLUDED."token_prefix",
  "estimated_duration_minutes" = EXCLUDED."estimated_duration_minutes",
  "is_active" = true,
  "updated_at" = now();

INSERT INTO "users" ("id", "name", "email", "platform_role", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000201', 'Asha Admin', 'admin@demo-clinic.test', NULL, now()),
  ('00000000-0000-4000-8000-000000000202', 'Neha Reception', 'reception@demo-clinic.test', NULL, now()),
  ('00000000-0000-4000-8000-000000000203', 'Dr. Anjali Shah', 'doctor@demo-clinic.test', NULL, now()),
  ('00000000-0000-4000-8000-000000000204', 'Sam Platform', 'superadmin@queuecare.test', 'SUPER_ADMIN', now())
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "platform_role" = EXCLUDED."platform_role",
  "status" = 'ACTIVE',
  "updated_at" = now();

-- Email and password sign-in for each seeded user. Better Auth stores the
-- hash on a "credential" account; this one is Better Auth's scrypt hash of
-- "queuecare-dev". accountId is the user's id, as Better Auth sets it.
INSERT INTO "accounts" ("id", "user_id", "account_id", "provider_id", "password", "updated_at")
SELECT a."id"::uuid, u."id", u."id"::text, 'credential', '109ae5333f8554ca619649980f83d948:199723461d5e1da5fa1cf94bb40b7648d10c702d8f6f25681e53ad6b82ee264eb7da941814ef4b003a6c6cf5440747965a44163da62dcfb158c98223e136139b', now()
FROM (VALUES
  ('00000000-0000-4000-8000-000000000401', 'admin@demo-clinic.test'),
  ('00000000-0000-4000-8000-000000000402', 'reception@demo-clinic.test'),
  ('00000000-0000-4000-8000-000000000403', 'doctor@demo-clinic.test'),
  ('00000000-0000-4000-8000-000000000404', 'superadmin@queuecare.test')
) AS a("id", "email")
JOIN "users" u ON u."email" = a."email"
ON CONFLICT ("provider_id", "account_id") DO UPDATE SET
  "password" = EXCLUDED."password",
  "updated_at" = now();

INSERT INTO "clinic_memberships" ("id", "clinic_id", "user_id", "role", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'CLINIC_ADMIN', now()),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'RECEPTIONIST', now()),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'DOCTOR', now())
ON CONFLICT ("clinic_id", "user_id") DO UPDATE SET
  "role" = EXCLUDED."role",
  "status" = 'ACTIVE',
  "updated_at" = now();

-- Today's queue in the clinic's own timezone, not UTC.
INSERT INTO "queues" ("id", "clinic_id", "service_id", "queue_date", "status", "updated_at")
SELECT gen_random_uuid(), s."clinic_id", s."id", (now() AT TIME ZONE c."timezone")::date, 'OPEN', now()
FROM "services" s
JOIN "clinics" c ON c."id" = s."clinic_id"
WHERE c."slug" = 'demo-clinic'
ON CONFLICT ("service_id", "queue_date") DO NOTHING;

-- Platform plan for pilot clinics. Real plans and prices are a Phase 10 decision.
INSERT INTO "plans" ("id", "code", "name", "price_monthly_minor", "currency", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000501', 'pilot', 'Pilot', 0, 'INR', now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "subscriptions" ("id", "clinic_id", "plan_id", "status", "trial_ends_at", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000501', 'TRIALING', now() + interval '90 days', now())
ON CONFLICT ("clinic_id") DO NOTHING;

COMMIT;
