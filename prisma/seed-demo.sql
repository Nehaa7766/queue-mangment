-- Dummy demo data for local development: busy queues today, 30 days of
-- history, a second doctor, two more clinics and a few support tickets.
-- Run it on the dev database only, after prisma/seed.sql:
--
--   docker compose exec app npx prisma db execute --file prisma/seed-demo.sql
--
-- Every row it creates has an id starting with 00000000-0000-4000-9, so each
-- run first removes the previous run's rows and leaves everything else alone.
-- Dates are relative to the day it runs. Seeded users sign in with the
-- password "queuecare-dev" (development only).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "clinics" WHERE "id" = '00000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Demo Clinic is missing. Run prisma/seed.sql first: npx prisma db seed';
  END IF;
END
$$;

-- Same names, counts and times on every run.
SELECT setseed(0.2026);

-- Dummy id for generated rows: 00000000-0000-4000-9KKK-NNNNNNNNNNNN, where
-- KKK is the kind of row and N counts up. Fixed rows use 9000 for KKK.
CREATE FUNCTION pg_temp.demo_id(kind integer, n bigint) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-9' || lpad(to_hex(kind), 3, '0') || '-'
    || lpad(to_hex(n), 12, '0'))::uuid
$$;

-- Clinic wall-clock time to the UTC-without-zone timestamps the app stores.
CREATE FUNCTION pg_temp.to_utc(local_time timestamp, zone text)
RETURNS timestamp
LANGUAGE sql IMMUTABLE AS $$
  SELECT (local_time AT TIME ZONE zone) AT TIME ZONE 'UTC'
$$;

-- "Now" and "today" in Demo Clinic's timezone.
CREATE TEMP TABLE demo_clock ON COMMIT DROP AS
SELECT now() AT TIME ZONE 'UTC' AS utc_now,
  now() AT TIME ZONE c."timezone" AS local_now,
  (now() AT TIME ZONE c."timezone")::date AS today,
  c."timezone" AS timezone
FROM "clinics" c
WHERE c."id" = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Remove the previous run
-- ---------------------------------------------------------------------------

DELETE FROM "audit_events" WHERE "id"::text LIKE '00000000-0000-4000-9%';
DELETE FROM "queue_tokens" WHERE "id"::text LIKE '00000000-0000-4000-9%';
-- Past queues this file made, unless someone has added tokens to them since.
DELETE FROM "queues" q
WHERE q."id"::text LIKE '00000000-0000-4000-9%'
  AND NOT EXISTS (SELECT 1 FROM "queue_tokens" t WHERE t."queue_id" = q."id");
DELETE FROM "service_assignments" WHERE "id"::text LIKE '00000000-0000-4000-9%';
DELETE FROM "support_tickets" WHERE "id"::text LIKE '00000000-0000-4000-9%';
DELETE FROM "platform_audit_events" WHERE "id"::text LIKE '00000000-0000-4000-9%';

-- Free the token numbers the removed rows used, so new numbers carry on from
-- the patients people added themselves.
UPDATE "queues" q
SET "next_sequence" = 1 + COALESCE((
  SELECT max(GREATEST(t."sequence_number", t."sort_key"))
  FROM "queue_tokens" t
  WHERE t."queue_id" = q."id"
), 0)
WHERE q."clinic_id" = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Clinics, people and plans
-- ---------------------------------------------------------------------------

INSERT INTO "clinics" ("id", "name", "slug", "timezone", "address", "phone", "created_at", "updated_at")
SELECT v."id"::uuid, v."name", v."slug", 'Asia/Kolkata', v."address", v."phone",
  k.utc_now - v."age", k.utc_now
FROM demo_clock k, (VALUES
  ('00000000-0000-4000-9000-000000000001', 'Sunrise Family Clinic', 'sunrise-family-clinic', 'Linking Road, Bandra West, Mumbai', '+91 22 0000 0000', interval '40 days'),
  ('00000000-0000-4000-9000-000000000002', 'CarePlus Dental', 'careplus-dental', '100 Feet Road, Indiranagar, Bengaluru', '+91 80 0000 0000', interval '25 days')
) AS v("id", "name", "slug", "address", "phone", "age")
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "address" = EXCLUDED."address",
  "phone" = EXCLUDED."phone",
  "status" = 'ACTIVE',
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "services" ("id", "clinic_id", "name", "description", "token_prefix", "estimated_duration_minutes", "updated_at")
VALUES
  ('00000000-0000-4000-9000-000000000101', '00000000-0000-4000-9000-000000000001', 'General', 'General consultation', 'A', 10, now()),
  ('00000000-0000-4000-9000-000000000102', '00000000-0000-4000-9000-000000000002', 'Dental check-up', 'Check-up and cleaning', 'D', 20, now())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "token_prefix" = EXCLUDED."token_prefix",
  "estimated_duration_minutes" = EXCLUDED."estimated_duration_minutes",
  "is_active" = true,
  "updated_at" = now();

INSERT INTO "users" ("id", "name", "email", "platform_role", "updated_at")
VALUES
  ('00000000-0000-4000-9000-000000000201', 'Dr. Rahul Mehta', 'doctor2@demo-clinic.test', NULL, now()),
  ('00000000-0000-4000-9000-000000000202', 'Meera Kapoor', 'admin@sunrise-clinic.test', NULL, now()),
  ('00000000-0000-4000-9000-000000000203', 'Vikram Rao', 'admin@careplus-dental.test', NULL, now())
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "status" = 'ACTIVE',
  "updated_at" = now();

-- Better Auth's scrypt hash of "queuecare-dev", as in prisma/seed.sql.
INSERT INTO "accounts" ("id", "user_id", "account_id", "provider_id", "password", "updated_at")
SELECT a."id"::uuid, u."id", u."id"::text, 'credential', '109ae5333f8554ca619649980f83d948:199723461d5e1da5fa1cf94bb40b7648d10c702d8f6f25681e53ad6b82ee264eb7da941814ef4b003a6c6cf5440747965a44163da62dcfb158c98223e136139b', now()
FROM (VALUES
  ('00000000-0000-4000-9000-000000000401', 'doctor2@demo-clinic.test'),
  ('00000000-0000-4000-9000-000000000402', 'admin@sunrise-clinic.test'),
  ('00000000-0000-4000-9000-000000000403', 'admin@careplus-dental.test')
) AS a("id", "email")
JOIN "users" u ON u."email" = a."email"
ON CONFLICT ("provider_id", "account_id") DO UPDATE SET
  "password" = EXCLUDED."password",
  "updated_at" = now();

INSERT INTO "clinic_memberships" ("id", "clinic_id", "user_id", "role", "updated_at")
VALUES
  ('00000000-0000-4000-9000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-9000-000000000201', 'DOCTOR', now()),
  ('00000000-0000-4000-9000-000000000302', '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000202', 'CLINIC_ADMIN', now()),
  ('00000000-0000-4000-9000-000000000303', '00000000-0000-4000-9000-000000000002', '00000000-0000-4000-9000-000000000203', 'CLINIC_ADMIN', now())
ON CONFLICT ("clinic_id", "user_id") DO UPDATE SET
  "role" = EXCLUDED."role",
  "status" = 'ACTIVE',
  "updated_at" = now();

-- Dr. Anjali Shah serves General and Dental; Dr. Rahul Mehta serves Pediatrics.
INSERT INTO "service_assignments" ("id", "membership_id", "service_id")
VALUES
  ('00000000-0000-4000-9000-000000000801', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-9000-000000000802', '00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000103'),
  ('00000000-0000-4000-9000-000000000803', '00000000-0000-4000-9000-000000000301', '00000000-0000-4000-8000-000000000102')
ON CONFLICT ("membership_id", "service_id") DO NOTHING;

-- A paid plan for the two extra clinics. Not a real price.
INSERT INTO "plans" ("id", "code", "name", "price_monthly_minor", "currency", "max_staff", "max_services", "updated_at")
VALUES ('00000000-0000-4000-9000-000000000501', 'standard', 'Standard', 149900, 'INR', 10, 5, now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "subscriptions" ("id", "clinic_id", "plan_id", "status", "current_period_end", "created_at", "updated_at")
SELECT v."id"::uuid, v."clinic_id"::uuid, p."id", v."status"::"SubscriptionStatus",
  k.utc_now + v."period_end", k.utc_now - v."age", k.utc_now
FROM demo_clock k
JOIN "plans" p ON p."code" = 'standard'
CROSS JOIN (VALUES
  ('00000000-0000-4000-9000-000000000601', '00000000-0000-4000-9000-000000000001', 'ACTIVE', interval '18 days', interval '39 days'),
  ('00000000-0000-4000-9000-000000000602', '00000000-0000-4000-9000-000000000002', 'PAST_DUE', interval '-4 days', interval '24 days')
) AS v("id", "clinic_id", "status", "period_end", "age")
ON CONFLICT ("clinic_id") DO UPDATE SET
  "plan_id" = EXCLUDED."plan_id",
  "status" = EXCLUDED."status",
  "trial_ends_at" = NULL,
  "current_period_end" = EXCLUDED."current_period_end",
  "updated_at" = EXCLUDED."updated_at";

INSERT INTO "support_tickets" ("id", "clinic_id", "created_by_user_id", "subject", "body", "status", "created_at", "updated_at")
SELECT v."id"::uuid, v."clinic_id"::uuid, v."user_id"::uuid, v."subject", v."body",
  v."status"::"SupportTicketStatus", k.utc_now - v."age", k.utc_now - v."last_change"
FROM demo_clock k, (VALUES
  ('00000000-0000-4000-9000-000000000701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
   'Waiting-room screen stops updating',
   'The live queue on the waiting-room TV stops changing after about an hour. Refreshing the page fixes it.',
   'OPEN', interval '3 hours', interval '3 hours'),
  ('00000000-0000-4000-9000-000000000702', '00000000-0000-4000-9000-000000000002', '00000000-0000-4000-9000-000000000203',
   'Card payment failed this month',
   'Our card expired and this month''s payment failed. How do we update the card?',
   'IN_PROGRESS', interval '4 days', interval '1 day'),
  ('00000000-0000-4000-9000-000000000703', '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000202',
   'How do I print the clinic QR code?',
   'We want to put the QR code at the front desk. Where can we download it?',
   'RESOLVED', interval '12 days', interval '11 days')
) AS v("id", "clinic_id", "user_id", "subject", "body", "status", "age", "last_change");

-- Actor is the seeded super admin, or nobody for self-service sign-ups.
INSERT INTO "platform_audit_events" ("id", "actor_user_id", "action", "target_type", "target_id", "metadata", "created_at")
SELECT v."id"::uuid, v."actor"::uuid, v."action", v."target_type", v."target_id",
  v."metadata"::jsonb, k.utc_now - v."age"
FROM demo_clock k, (VALUES
  ('00000000-0000-4000-9000-000000000901', NULL, 'clinic.signed_up', 'clinic', '00000000-0000-4000-9000-000000000001', '{"slug": "sunrise-family-clinic"}', interval '40 days'),
  ('00000000-0000-4000-9000-000000000902', '00000000-0000-4000-8000-000000000204', 'clinic.activated', 'clinic', '00000000-0000-4000-9000-000000000001', '{"previousStatus": "INACTIVE", "newStatus": "ACTIVE"}', interval '39 days'),
  ('00000000-0000-4000-9000-000000000903', '00000000-0000-4000-8000-000000000204', 'subscription.created', 'subscription', '00000000-0000-4000-9000-000000000601', '{"plan": "standard"}', interval '39 days'),
  ('00000000-0000-4000-9000-000000000904', NULL, 'clinic.signed_up', 'clinic', '00000000-0000-4000-9000-000000000002', '{"slug": "careplus-dental"}', interval '25 days'),
  ('00000000-0000-4000-9000-000000000905', '00000000-0000-4000-8000-000000000204', 'clinic.activated', 'clinic', '00000000-0000-4000-9000-000000000002', '{"previousStatus": "INACTIVE", "newStatus": "ACTIVE"}', interval '24 days'),
  ('00000000-0000-4000-9000-000000000906', '00000000-0000-4000-8000-000000000204', 'subscription.created', 'subscription', '00000000-0000-4000-9000-000000000602', '{"plan": "standard"}', interval '24 days'),
  ('00000000-0000-4000-9000-000000000907', '00000000-0000-4000-8000-000000000204', 'support_ticket.status_changed', 'support_ticket', '00000000-0000-4000-9000-000000000703', '{"status": "RESOLVED"}', interval '11 days'),
  ('00000000-0000-4000-9000-000000000908', '00000000-0000-4000-8000-000000000204', 'subscription.updated', 'subscription', '00000000-0000-4000-9000-000000000602', '{"status": "PAST_DUE"}', interval '4 days'),
  ('00000000-0000-4000-9000-000000000909', '00000000-0000-4000-8000-000000000204', 'support_ticket.status_changed', 'support_ticket', '00000000-0000-4000-9000-000000000702', '{"status": "IN_PROGRESS"}', interval '1 day')
) AS v("id", "actor", "action", "target_type", "target_id", "metadata", "age");

-- ---------------------------------------------------------------------------
-- Demo Clinic queues
-- ---------------------------------------------------------------------------

-- Today's queues, as prisma/seed.sql makes them, in case it last ran on an
-- earlier day.
INSERT INTO "queues" ("id", "clinic_id", "service_id", "queue_date", "status", "updated_at")
SELECT gen_random_uuid(), s."clinic_id", s."id", k.today, 'OPEN', k.utc_now
FROM "services" s, demo_clock k
WHERE s."clinic_id" = '00000000-0000-4000-8000-000000000001'
ON CONFLICT ("service_id", "queue_date") DO NOTHING;

-- Closed queues for the last 30 days. The clinic is shut on Sundays.
INSERT INTO "queues" ("id", "clinic_id", "service_id", "queue_date", "status", "created_at", "updated_at")
SELECT pg_temp.demo_id(256, row_number() OVER (ORDER BY d.day, s."token_prefix")),
  s."clinic_id", s."id", d.day, 'CLOSED',
  pg_temp.to_utc(d.day + time '08:45', k.timezone),
  pg_temp.to_utc(d.day + time '14:30', k.timezone)
FROM demo_clock k
CROSS JOIN LATERAL (
  SELECT k.today - n AS day FROM generate_series(1, 30) AS n
) AS d
CROSS JOIN "services" s
WHERE s."id" IN (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103'
  )
  AND extract(isodow FROM d.day) <> 7
ON CONFLICT ("service_id", "queue_date") DO NOTHING;

-- Every dummy token, before it is written to queue_tokens and audit_events.
-- Times are UTC.
CREATE TEMP TABLE demo_tokens (
  n serial,
  queue_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  service_id uuid NOT NULL,
  prefix text NOT NULL,
  seq integer NOT NULL,
  patient_name text,
  status text NOT NULL,
  doctor_id uuid,
  walk_in boolean NOT NULL,
  joined_at timestamp NOT NULL,
  called_at timestamp,
  started_at timestamp,
  completed_at timestamp,
  skipped_at timestamp,
  cancelled_at timestamp
) ON COMMIT DROP;

-- Past days: General is busiest, Mondays busier still. Patients arrive from
-- 09:00 to about 14:00; most are seen, a few miss their call or cancel.
INSERT INTO demo_tokens (queue_id, clinic_id, service_id, prefix, seq, patient_name, status, doctor_id, walk_in, joined_at, called_at, started_at, completed_at, skipped_at, cancelled_at)
WITH names AS (
  -- First names or initials only, as the app allows.
  SELECT ARRAY['Priya', 'Arjun', 'Ananya', 'Rohan', 'Kavya', 'Vihaan', 'Isha',
    'Aditya', 'Meera', 'Kabir', 'Diya', 'Reyansh', 'Saanvi', 'Ayaan', 'Aarohi',
    'Vivaan', 'Tara', 'Ishaan', 'Myra', 'Dev', 'Riya', 'Krish', 'Neel', 'Pooja',
    'Sunita', 'Ramesh', 'Lakshmi', 'Farhan', 'Zoya', 'Gurpreet', 'Harsh',
    'Nisha', 'R.K.', 'S.M.', 'A.P.', 'J.D.', 'M.N.', 'K.S.'] AS list
),
day_queue AS (
  SELECT q."id" AS queue_id, q."clinic_id", q."service_id", q."queue_date",
    q."next_sequence", s."token_prefix" AS prefix,
    s."estimated_duration_minutes" AS minutes,
    (CASE s."token_prefix" WHEN 'A' THEN 14 WHEN 'B' THEN 9 ELSE 5 END)
      + (CASE WHEN extract(isodow FROM q."queue_date") = 1 THEN 4 ELSE 0 END)
      + floor(random() * 6)::integer AS patients
  FROM "queues" q
  JOIN "services" s ON s."id" = q."service_id"
  CROSS JOIN demo_clock k
  WHERE s."id" IN (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000103'
    )
    AND q."queue_date" BETWEEN k.today - 30 AND k.today - 1
),
patient AS (
  SELECT d.*, p.k,
    random() AS r_status, random() AS r_name, random() AS r_anon,
    random() AS r_walk, random() AS r_wait, random() AS r_length,
    d."queue_date" + time '09:00'
      + ((p.k - 1) * 300.0 / d.patients + random() * 6) * interval '1 minute'
      AS joined_local
  FROM day_queue d
  CROSS JOIN LATERAL generate_series(1, d.patients) AS p(k)
),
outcome AS (
  SELECT p.*,
    CASE
      WHEN p.r_status < 0.05 THEN 'CANCELLED'
      WHEN p.r_status < 0.12 THEN 'SKIPPED'
      ELSE 'COMPLETED'
    END AS status,
    p.joined_local + (5 + p.r_wait * 30) * interval '1 minute' AS called_local
  FROM patient p
)
SELECT o.queue_id, o."clinic_id", o."service_id", o.prefix,
  o."next_sequence" + o.k - 1,
  CASE WHEN o.r_anon < 0.15 THEN NULL
    ELSE nm.list[1 + floor(o.r_name * cardinality(nm.list))::integer]
  END,
  o.status,
  CASE WHEN o.status = 'COMPLETED' THEN
    CASE o.prefix
      WHEN 'B' THEN '00000000-0000-4000-9000-000000000201'::uuid
      ELSE '00000000-0000-4000-8000-000000000203'::uuid
    END
  END,
  o.r_walk < 0.4,
  pg_temp.to_utc(o.joined_local, k.timezone),
  CASE WHEN o.status <> 'CANCELLED'
    THEN pg_temp.to_utc(o.called_local, k.timezone) END,
  CASE WHEN o.status = 'COMPLETED'
    THEN pg_temp.to_utc(o.called_local + (1 + o.r_length * 2) * interval '1 minute', k.timezone) END,
  CASE WHEN o.status = 'COMPLETED'
    THEN pg_temp.to_utc(o.called_local + (1 + o.r_length * 2 + o.minutes * (0.6 + o.r_length * 0.8)) * interval '1 minute', k.timezone) END,
  -- No-shows are skipped when the 5-minute grace period runs out.
  CASE WHEN o.status = 'SKIPPED'
    THEN pg_temp.to_utc(o.called_local + interval '5 minutes', k.timezone) END,
  CASE WHEN o.status = 'CANCELLED'
    THEN pg_temp.to_utc(o.joined_local + (8 + o.r_wait * 20) * interval '1 minute', k.timezone) END
FROM outcome o
CROSS JOIN demo_clock k
CROSS JOIN names nm
ORDER BY o."queue_date", o.prefix, o.k;

-- Today: a live queue for each service. Each step is minutes before now
-- (NULL where it hasn't happened); "ended" is when the token was completed,
-- skipped or cancelled. Squeezed towards now when run soon after midnight,
-- so every time stays within today.
INSERT INTO demo_tokens (queue_id, clinic_id, service_id, prefix, seq, patient_name, status, doctor_id, walk_in, joined_at, called_at, started_at, completed_at, skipped_at, cancelled_at)
SELECT q."id", q."clinic_id", q."service_id", v.prefix,
  q."next_sequence" + v.k - 1,
  v.name,
  v.status,
  CASE WHEN v.status IN ('COMPLETED', 'IN_SERVICE') THEN
    CASE v.prefix
      WHEN 'B' THEN '00000000-0000-4000-9000-000000000201'::uuid
      ELSE '00000000-0000-4000-8000-000000000203'::uuid
    END
  END,
  v.walk_in,
  k.utc_now - v.joined * f.scale * interval '1 minute',
  k.utc_now - v.called * f.scale * interval '1 minute',
  k.utc_now - v.started * f.scale * interval '1 minute',
  CASE WHEN v.status = 'COMPLETED' THEN k.utc_now - v.ended * f.scale * interval '1 minute' END,
  CASE WHEN v.status = 'SKIPPED' THEN k.utc_now - v.ended * f.scale * interval '1 minute' END,
  CASE WHEN v.status = 'CANCELLED' THEN k.utc_now - v.ended * f.scale * interval '1 minute' END
FROM demo_clock k
CROSS JOIN LATERAL (
  SELECT LEAST(1.0, extract(epoch FROM k.local_now - k.today::timestamp) / 60 / 100)::double precision AS scale
) AS f
CROSS JOIN (VALUES
  -- General: Dr. Anjali Shah is with A-7.
  ('A', 1, 'COMPLETED', 'Priya', false, 95, 80, 79, 70),
  ('A', 2, 'COMPLETED', 'Arjun', true, 90, 69, 68, 59),
  ('A', 3, 'COMPLETED', NULL, false, 84, 58, 57, 47),
  ('A', 4, 'COMPLETED', 'Kavya', true, 76, 46, 45, 36),
  ('A', 5, 'COMPLETED', 'R.K.', false, 70, 35, 34, 24),
  ('A', 6, 'SKIPPED', 'Rohan', false, 62, 23, NULL, 18),
  ('A', 7, 'IN_SERVICE', 'Sunita', true, 55, 17, 15, NULL),
  ('A', 8, 'CANCELLED', 'Farhan', false, 48, NULL, NULL, 30),
  ('A', 9, 'WAITING', 'Ananya', false, 40, NULL, NULL, NULL),
  ('A', 10, 'WAITING', NULL, true, 26, NULL, NULL, NULL),
  ('A', 11, 'WAITING', 'Dev', false, 9, NULL, NULL, NULL),
  -- Pediatrics: Dr. Rahul Mehta is with the fourth patient.
  ('B', 1, 'COMPLETED', 'Aarohi', false, 80, 70, 69, 55),
  ('B', 2, 'COMPLETED', 'Vihaan', true, 72, 54, 53, 38),
  ('B', 3, 'COMPLETED', 'Myra', false, 60, 37, 36, 22),
  ('B', 4, 'IN_SERVICE', 'Kabir', false, 50, 21, 20, NULL),
  ('B', 5, 'WAITING', 'Diya', true, 41, NULL, NULL, NULL),
  ('B', 6, 'WAITING', 'Ayaan', false, 28, NULL, NULL, NULL),
  ('B', 7, 'WAITING', NULL, false, 12, NULL, NULL, NULL),
  -- Dental: the third patient has just been called.
  ('C', 1, 'COMPLETED', 'Ramesh', true, 90, 75, 74, 52),
  ('C', 2, 'COMPLETED', 'Lakshmi', false, 70, 51, 50, 29),
  ('C', 3, 'CALLED', 'Gurpreet', false, 45, 3, NULL, NULL),
  ('C', 4, 'WAITING', 'Nisha', true, 35, NULL, NULL, NULL),
  ('C', 5, 'WAITING', 'Harsh', false, 20, NULL, NULL, NULL),
  ('C', 6, 'WAITING', 'S.M.', false, 6, NULL, NULL, NULL)
) AS v(prefix, k, status, name, walk_in, joined, called, started, ended)
JOIN "services" s
  ON s."clinic_id" = '00000000-0000-4000-8000-000000000001'
  AND s."token_prefix" = v.prefix
JOIN "queues" q ON q."service_id" = s."id" AND q."queue_date" = k.today
ORDER BY v.prefix, v.k;

INSERT INTO "queue_tokens" ("id", "public_token_id", "queue_id", "clinic_id", "service_id", "sequence_number", "sort_key", "token_label", "patient_name", "status", "assigned_doctor_id", "created_by_user_id", "joined_at", "called_at", "service_started_at", "completed_at", "skipped_at", "cancelled_at", "created_at", "updated_at")
SELECT pg_temp.demo_id(512, t.n), gen_random_uuid()::text, t.queue_id,
  t.clinic_id, t.service_id, t.seq, t.seq, t.prefix || '-' || t.seq,
  t.patient_name, t.status::"TokenStatus", t.doctor_id,
  CASE WHEN t.walk_in THEN '00000000-0000-4000-8000-000000000202'::uuid END,
  t.joined_at, t.called_at, t.started_at, t.completed_at, t.skipped_at,
  t.cancelled_at, t.joined_at,
  COALESCE(t.completed_at, t.skipped_at, t.cancelled_at, t.started_at, t.called_at, t.joined_at)
FROM demo_tokens t;

-- The same history the app records: who did what to each token, and when.
-- Doctors call their own patients; reception calls the rest, marks no-shows
-- and cancels.
INSERT INTO "audit_events" ("id", "clinic_id", "queue_id", "token_id", "actor_user_id", "action", "previous_state", "new_state", "created_at")
SELECT pg_temp.demo_id(768, row_number() OVER (ORDER BY e.at, t.n, e.step)),
  t.clinic_id, t.queue_id, pg_temp.demo_id(512, t.n), e.actor, e.action,
  e.previous_state, e.new_state, e.at
FROM demo_tokens t
CROSS JOIN LATERAL (VALUES
  (1, t.joined_at,
    CASE WHEN t.walk_in THEN '00000000-0000-4000-8000-000000000202'::uuid END,
    CASE WHEN t.walk_in THEN 'token.walk_in_registered' ELSE 'token.joined' END,
    NULL, 'WAITING'),
  (2, t.called_at,
    COALESCE(t.doctor_id, '00000000-0000-4000-8000-000000000202'::uuid),
    'token.called', 'WAITING', 'CALLED'),
  (3, t.started_at, t.doctor_id, 'consultation.started', 'CALLED', 'IN_SERVICE'),
  (4, t.completed_at, t.doctor_id, 'consultation.completed', 'IN_SERVICE', 'COMPLETED'),
  (5, t.skipped_at, '00000000-0000-4000-8000-000000000202'::uuid, 'token.skipped', 'CALLED', 'SKIPPED'),
  (6, t.cancelled_at, '00000000-0000-4000-8000-000000000202'::uuid, 'token.cancelled', 'WAITING', 'CANCELLED')
) AS e(step, at, actor, action, previous_state, new_state)
WHERE e.at IS NOT NULL;

-- Move each queue's counter past the numbers just used.
UPDATE "queues" q
SET "next_sequence" = 1 + (
  SELECT max(GREATEST(t."sequence_number", t."sort_key"))
  FROM "queue_tokens" t
  WHERE t."queue_id" = q."id"
)
WHERE q."id" IN (SELECT queue_id FROM demo_tokens);

COMMIT;
