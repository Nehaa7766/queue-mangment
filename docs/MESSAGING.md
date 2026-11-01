# Messaging between patients and the clinic

Private, text-only chats between a patient's visit and the clinic, plus
announcements sent privately to many waiting patients. Decided with the
product owner on 2026-11-01; the original brief was a generic "two-way
messaging" prompt, adapted here to how QueueCare actually works.

Shared contract: `src/features/messaging/contracts.ts`. Schema: the
"Messaging" section of `prisma/schema.prisma`.

## Decisions

| # | Decision |
|---|---|
| 1 | One chat per visit (token) per side. No patient accounts: the private token link (`/token/<publicTokenId>`, a random UUID, never the token number) is the patient's credential. |
| 2 | Two separate chats on the token page: **Reception** and **Doctor**. Each is private to its side. |
| 3 | Reception chat: receptionists and clinic admins. |
| 4 | Doctor chat follows the visit (see Routing). |
| 5 | Chats turn read-only 2 hours after the visit ends (completed, cancelled or no-show), or 24 hours after joining. A requeued token reopens naturally. No manual close or reopen in v1. |
| 6 | Patients may write first, with a rate limit. |
| 7 | Announcements: reception and clinic admins send one text to everyone waiting or called today, in all or chosen services. Each patient gets it as a separate message in their own reception chat. |
| 8 | Patients see "Reception" for the desk and the doctor's own name for doctors. Staff see each other's names. |
| 9 | Messages, chats and announcements are deleted with patient names by the retention job (clinic setting, default 30 days). |
| 10 | Patient screens show "For questions about your visit. Not for medical emergencies." |
| 11 | Live updates use Server-Sent Events and PostgreSQL LISTEN/NOTIFY, not Socket.IO: the app runs as a standard Next.js server, and this needs no extra service or library. No typing indicators. |
| 12 | Ticks: Sent, then Seen (the other side opened the chat). No per-device "delivered" state. |
| 13 | No attachments. No offline storage beyond unsent messages kept in the page's `localStorage` for retry. |

## Routing: who sees which chat

Access is computed on the server from the token's current state on every
request (`src/features/messaging/access.ts`). Nothing about access is
stored, so it follows the visit automatically.

**Reception chat:** staff with role RECEPTIONIST or CLINIC_ADMIN in the
token's clinic.

**Doctor chat**, in order:

1. **Assigned doctor.** Once a doctor starts the consultation
   (`queue_tokens.assigned_doctor_id` is set), only that doctor. Other
   doctors and reception lose access, including to the history. If another
   doctor later starts the visit (after a requeue), access moves to them.
   After the visit ends, the assigned doctor keeps read-only access until
   the chat is deleted.
2. **Service doctors.** Before that: active doctors who serve the token's
   service, using the same rule as the doctor screens
   (`src/features/doctor/serving-doctors.ts`): a doctor with service
   assignments serves only those; one without serves every service.
   Doctors of other services never see it.
3. **Reception fallback.** If no active doctor serves the service,
   RECEPTIONIST and CLINIC_ADMIN answer it, and the patient sees that
   reception is answering for the doctor.

Clinic admins do not see doctor chats except through the fallback.
Recipients are always resolved on the server; screens never send user IDs.
When a doctor starts a visit that has a doctor chat, an audit event
`message.doctor_assigned` is recorded in the same transaction.

## Data model

- `conversations`: one per (token, channel), unique. Unread counters for
  each side, each side's last read time, `last_message_at`.
- `messages`: text up to 1,000 characters, sender PATIENT or STAFF (with the
  staff user), `client_message_id` unique per conversation for retries,
  optional `broadcast_id`.
- `broadcasts`: the announcement text, chosen services (empty = all),
  recipient total, idempotency key unique per clinic, SENDING or DONE.
- `broadcast_recipients`: one row per token, fixed at creation. PENDING →
  SENT, SKIPPED (with reason) or FAILED (after 5 errors). These rows are
  the work queue; no separate outbox event is needed.

## Sending a message

1. The screen shows the message as "Sending" with a fresh
   `clientMessageId` (UUID) and keeps it in `localStorage` until stored.
2. POST to the messages endpoint. The server checks the session or token
   link, the access rule, that the chat is open, the rate limit and the
   text (`messageBodySchema`).
3. One transaction: find or create the conversation, insert the message
   (on a repeated `clientMessageId`, return the stored one: 200 instead of
   201; a different text with the same id is `IDEMPOTENCY_CONFLICT`),
   update the counters, and `pg_notify('queuecare_messaging', …)`.
   PostgreSQL delivers the notification only if the transaction commits.
4. The response means "stored". The screen marks it Sent and drops it from
   `localStorage`. On a network error it shows Retry, and retries
   automatically when the browser comes back online, with the same id.

Reading: opening a chat (and new messages arriving while it is open and
the tab visible) POSTs `read`, which sets that side's read time, resets its
unread counter and notifies the other side so "Seen" updates. A `read` with
nothing new to mark changes nothing and sends no hint. Sending a message
also counts as reading for the sender's side (writing a reply means the
earlier messages were seen); announcements do not.

## Live updates

- Each web server process holds one extra PostgreSQL connection that runs
  `LISTEN queuecare_messaging` (`src/features/messaging/live.ts`), with
  reconnect and backoff.
- Notification payloads carry ids and routing only, never message text:
  `{ type, clinicId, conversationId, tokenId, channel, serviceId,
  assignedDoctorId, routing, previousRouting?, actor }`, or
  `{ type: "broadcast", clinicId, broadcastId }`. `actor` (PATIENT, STAFF or
  SYSTEM) is the side that caused it, so a `read` only reaches the other
  side. `previousRouting` is set when a doctor starts the visit; the
  doctors (or reception, after a fallback) who just lost the chat also get
  that `conversation` hint, so their screens refetch and drop it.
- Streams: `GET /api/public/tokens/<id>/messages/events` (patient, matched
  by token) and `GET /api/messages/events` (staff, matched by clinic and
  the routing rule against the staff member's role, user id and doctor
  service assignments loaded when the stream opens).
- Streams send `event: messaging` hints (`MessagingEvent`) and a comment
  every 25 seconds, and close after 5 minutes so access and sessions are
  rechecked when EventSource reconnects. Response headers:
  `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no`.
- On every hint, and on every reconnect, the screen refetches through REST.
  REST is the only path that returns message text, and it checks access on
  every call, so a revoked doctor stops seeing content immediately.
- Limits: 3 open streams per token link, 5 per staff member (per process).
  One more answers `429 RATE_LIMITED` instead of opening a stream.
- If the LISTEN connection drops, open streams stay open (comments only)
  and the listener reconnects with backoff (1 s doubling to 30 s). Once it
  is listening again, every stream that may have missed hints is ended, so
  EventSource reconnects and the screens refetch.
- `Cache-Control: no-transform` also stops the server from gzipping the
  stream, which would otherwise buffer it (checked against the standalone
  production server).

## Announcements

1. Composer: text, services (all or chosen), live count of eligible
   patients (`GET …/audience`), preview, confirmation dialog that says each
   patient gets a separate private message.
2. POST creates the broadcast and its recipient rows in one transaction
   (patients waiting or called today in those services) and records the
   audit event `message.broadcast_sent`. A repeated idempotency key returns
   the existing announcement. Zero eligible patients is a validation error.
3. Processing runs right after the response (`after()` from `next/server`)
   and again on every outbox worker run (`/api/internal/outbox/process`),
   so a crash only delays it. Batches of 20 recipients (at most 10 batches
   per run); each recipient is claimed with `FOR UPDATE SKIP LOCKED` inside
   its own transaction, so concurrent runs skip rows another run holds.
   Per recipient, one transaction: recheck that
   the token is still waiting or called (otherwise SKIPPED with
   `VISIT_ENDED` or `IN_CONSULTATION`) and that the chat is open
   (`CHAT_CLOSED`), find or create the reception chat, insert the message
   with `client_message_id = "announcement:<broadcastId>"` (so a rerun
   cannot duplicate it), mark SENT, notify. Errors: attempts + 1, tried
   again on a later run (at most once per run); FAILED after 5. The stored
   error never contains the text. When nothing is PENDING, the broadcast
   becomes DONE.
4. Progress page: total, sent, seen, skipped (with reasons), failed,
   pending, and a recipient list. A patient who is offline is still SENT:
   the message waits in their chat.

## Limits and security

- Patient sends: 10 a minute per token link. Staff sends: 30 a minute per
  user. Announcements: 5 per 10 minutes per clinic. A retry (a stored
  `clientMessageId` or idempotency key) is answered first and does not
  count, so a retry after a lost response never gets `429`; only new
  messages and announcements count.
- Text only, rendered as text (React escapes it). 1,000 characters.
- Tenant isolation: every query filters by the clinic from the session or
  from the token link; a conversation id from another clinic is 404.
- A patient can only reach their own token's chats; conversation ids are
  never accepted from patients.
- Message text is never written to logs, audit events or notifications.
- Errors use the existing format. New codes: `CONVERSATION_NOT_FOUND`
  (404), `ANNOUNCEMENT_NOT_FOUND` (404), `CONVERSATION_CLOSED` (409).
- Retention (`src/features/retention/retention.ts`): messages and
  announcements (with their recipient rows) older than the clinic's
  retention period are deleted, then chats that are old and have no
  messages left. One audit event per clinic, `retention.messages_deleted`,
  records the counts.

## Screens

**Patient.** Laid out like a messaging app
(`src/components/patient/patient-messages.tsx`, `patient-chat-screen.tsx`):

- Phones, token page: a "Messages" button with the unread total at the top,
  a Messages card under the ticket with one row per chat (who answers,
  unread count), and a bar pinned to the bottom while something is unread.
  Each opens the full-screen chat.
- Phones, chat screen `/token/<id>/messages?with=reception|doctor` (route
  group `(patient-chat)`, no patient top bar): header with the way back,
  who they're talking to and Live; Reception / Doctor tabs with unread
  counts; the emergency note and who answers the doctor chat; history;
  composer pinned at the bottom (the page resizes with the keyboard).
- Desktop (≥ 1024 px), token page: two columns, the ticket on the left and
  the same chat beside it, sticky and sized to the screen. It mounts only
  at desktop widths, so a chat hidden on a phone is never marked read.

Chat: patient on the right, clinic on the left, timestamps,
Sending/Sent/Seen/Failed with Retry, "load older", empty, closed and error
states. One live connection serves the whole token page.

**Staff "Messages" page** (reception, doctor, clinic admin): inbox and
conversation side by side on desktop, one at a time on phones. Inbox:
search (token or patient name), filters All / Unread / Open / Closed,
channel filter for reception, token and service context, last message,
unread count. Conversation: header with token, service and status, history,
composer, Seen ticks. Unread badge on the "Messages" nav item. A "Message"
action on live queue rows starts a reception chat with that patient.

**Announcements** (reception, clinic admin): list with progress, composer,
progress page with recipient statuses.

## Testing

Unit: body normalisation and limits, closure rule, routing rule. Integration
(test database): idempotent send, access for every routing case including a
doctor starting the visit while a patient sends, cross-clinic and
cross-patient isolation, closed chats, read counters, announcement creation
(idempotency, snapshot, zero eligible), processing (skips, rerun safety,
concurrent processors, failure after 5), retention. E2E (mandatory):
an announcement to patients A and B; A replies; staff sees A's reply; B
cannot see it or open A's chat; staff replies privately to A; A goes
offline, staff sends again, A comes back and gets it once; Seen reflects
reads.

## API reference

All responses use the shapes in `contracts.ts`; errors use the standard
format (`{ "error": { "code", "message", "requestId" } }`). Any endpoint
can also answer `500 INTERNAL_ERROR`. Bodies are JSON. Problems with the
message text keep the schema's wording ("Write a message first.", "Keep it
under 1,000 characters."); other body problems say "Some fields are
missing or invalid."

### Patient (the token link is the credential)

`<id>` is the token's `publicTokenId`; `<channel>` is `reception` or
`doctor`. An unknown link is `404 TOKEN_NOT_FOUND`; an unknown channel is
`404 CONVERSATION_NOT_FOUND`.

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/public/tokens/<id>/messages` | --- | `200 PatientMessagingSummary` | 404 |
| `GET /api/public/tokens/<id>/messages/<channel>` | `?before=<messageId>` (optional) | `200 MessagePage`; an empty page with `conversationId: null` before the first message | 404; `400 VALIDATION_ERROR` when `before` is not a message in this chat |
| `POST /api/public/tokens/<id>/messages/<channel>` | `SendMessageBody` | `201 MessageView`; `200 MessageView` for a repeated `clientMessageId` | `400 VALIDATION_ERROR`; 404; `409 CONVERSATION_CLOSED`; `409 IDEMPOTENCY_CONFLICT` (same id, different text); `429 RATE_LIMITED` (10 new messages a minute per link) |
| `POST /api/public/tokens/<id>/messages/<channel>/read` | --- | `200 { ok: true }`, also before the first message | 404 |
| `GET /api/public/tokens/<id>/messages/events` | --- | `200 text/event-stream` | 404; `429 RATE_LIMITED` (more than 3 open) |

A repeated `clientMessageId` returns the stored message even after the
chat has closed, and is answered before the rate limit counts. The patient stream gets `message` hints from both sides,
`read` hints when staff read, and `conversation` hints.

### Staff (session cookie)

Signed out is `401 UNAUTHENTICATED`. Signed in without an active clinic
membership is `403 FORBIDDEN`. Endpoints without an id use the staff
member's first active membership (as the staff screens do); endpoints with
a chat or token id use their membership in that chat's clinic. A chat in
another clinic, or one the routing rule does not give them right now, is
`404 CONVERSATION_NOT_FOUND`.

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/messages/conversations` | `?filter=all\|unread\|open\|closed`, `channel=reception\|doctor`, `q` (token label or patient name, up to 80 characters), `cursor` (the previous `nextCursor`) | `200 InboxPage`: 30 a page, newest message first, chats without messages last | 401; 403; `400 VALIDATION_ERROR` (unknown filter or channel, bad cursor) |
| `GET /api/messages/conversations/<conversationId>/messages` | `?before=<messageId>` (optional) | `200 MessagePage` | 401; 404; 400 (bad `before`) |
| `POST /api/messages/conversations/<conversationId>/messages` | `SendMessageBody` | `201 MessageView`; `200` for a repeated `clientMessageId` | 400; 401; 404; `409 CONVERSATION_CLOSED`; `409 IDEMPOTENCY_CONFLICT` (same id with different text, or from someone else); `429 RATE_LIMITED` (30 new messages a minute per user) |
| `POST /api/messages/conversations/<conversationId>/read` | --- | `200 { ok: true }` | 401; 404 |
| `POST /api/messages/tokens/<tokenId>/<channel>` | --- | `201 { conversationId }` when created; `200` when it already existed | 401; `404 TOKEN_NOT_FOUND` (unknown token, or another clinic's); `404 CONVERSATION_NOT_FOUND` (unknown channel, or the routing rule doesn't give them that side); `409 CONVERSATION_CLOSED` (closed and never started) |
| `GET /api/messages/unread` | --- | `200 UnreadSummary`: chats they may see with unread patient messages | 401; 403 |
| `GET /api/messages/events` | --- | `200 text/event-stream` | 401; 403; `429 RATE_LIMITED` (more than 5 open) |

The assigned doctor keeps read access after the visit ends; sends then
get `409 CONVERSATION_CLOSED`. Staff names in `senderName`: the staff
member's name, or "Former staff member" once the account is deleted.

### Announcements (reception and clinic admins)

Doctors get `403 FORBIDDEN`.

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/messages/announcements` | --- | `200 BroadcastSummary[]`, the 50 newest first | 401; 403 |
| `POST /api/messages/announcements` | `CreateBroadcastBody` | `201 BroadcastSummary` (`SENDING`, every recipient pending); `200` for a repeated `idempotencyKey` | `400 VALIDATION_ERROR` (bad body, another clinic's service, or nobody eligible); 401; 403; `409 IDEMPOTENCY_CONFLICT` (same key, different text or services); `429 RATE_LIMITED` (5 new announcements per 10 minutes per clinic) |
| `GET /api/messages/announcements/audience` | `?serviceIds=a,b` (optional; none means every service) | `200 BroadcastAudience`: `eligible` for the choice; `services` lists active services (and any turned off today that still has patients) with their own counts | 400 (malformed id or another clinic's service); 401; 403 |
| `GET /api/messages/announcements/<broadcastId>` | --- | `200 BroadcastDetail`, recipients in joining order | 401; 403; `404 ANNOUNCEMENT_NOT_FOUND` (unknown, or another clinic's) |

`counts.seen` counts SENT recipients whose read time is at or after their
announcement message. Patients see announcements from "Reception".

### Internal

`POST /api/internal/outbox/process` (job token) also delivers pending
announcements and now answers `{ claimed, sent, retrying, failed,
announcements: { sent, skipped, retrying, failed, completed } }`.

## Known limits (v1)

- Patients only see messages while their token page is open. No SMS,
  WhatsApp or push notifications yet (Web Push is the planned next step).
- Live updates assume one web server process. Several processes still work
  (each listens to PostgreSQL), so no Redis is needed.
- Unsent messages survive a page refresh through `localStorage`, but not a
  cleared browser.
