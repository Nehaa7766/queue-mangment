# QueueCare --- Privacy and Data Retention

What personal data QueueCare holds, why, and how long it keeps it.
Written for clinic owners and whoever runs the service. This is a
working draft for the pilot, **not legal advice**: the open questions at
the end need a review by qualified counsel before commercial launch
(PLAN.md §13).

## Principles

- Collect the least data that makes the queue work.
- No medical data: no diagnosis, symptoms, prescriptions or notes.
- Patients don't need an account, phone number or email.
- Clear what isn't needed any more, automatically.

## What we hold

### Patients

| Data | Why | Kept for |
|---|---|---|
| First name or initials (optional, up to 80 characters) | So reception and the doctor know who to call | Cleared after the clinic's retention period (default **30 days**) |
| Token number, service, clinic | To run the queue | Kept, without the name, for analytics |
| Times joined, called, seen, finished, skipped or cancelled | Wait-time estimates and reports | Kept, without the name, for analytics |
| Random link ID (`/token/...`) | Lets the patient check their status without an account | Kept with the token; reveals nothing once the name is cleared |
| IP address | Rate limiting against abuse | Not stored; held in server memory for about a minute |
| Chat messages with the clinic (text, up to 1,000 characters, and when each side read them) | Questions about the visit (docs/MESSAGING.md) | Deleted after the clinic's retention period (default **30 days**) |

Not collected: phone number, email, address, date of birth, medical
details. Reception and patients are told to enter a first name or
initials only. Chats are free text, so a patient could still type
something personal: the chat screens say they are "For questions about
your visit. Not for medical emergencies.", message text is never written
to logs, audit events or live notifications, and it is deleted with the
retention period below.

### Staff

| Data | Why | Kept for |
|---|---|---|
| Name, email, role, clinic | Sign-in and permissions | While the account exists |
| Password | Sign-in | Stored only as a salted hash |
| Sessions (with IP address and browser) | Keeping staff signed in; spotting misuse | 12 hours per session |
| Audit events (who did what, when) | Accountability (PLAN.md §9 rule 15) | Not yet decided; see open questions |
| Messages staff send to patients, and announcements (text, sender, recipients) | Answering patients; one text to many waiting patients | Deleted after the clinic's retention period |

### Operational data

| Data | Kept for |
|---|---|
| Idempotency records (stop double taps creating two tokens; include a hash of the request, which contains the name) | 2 days |
| Outbox events (queued emails; one-time links are removed once sent) | Until processed; then kept without links |
| Server logs (request IDs and errors; no names by design) | Per the hosting provider; aim for 30 days |
| Database backups | 30 days, so names don't outlive the retention period by more than a month |

## Retention in practice

A scheduled job (`POST /api/internal/retention/run`, daily; RUNBOOK.md)
clears patient names on tokens whose visit is older than the clinic's
**patient data retention** setting. The default is 30 days. This is an
**assumption to confirm with the pilot clinic**: it is long enough to
answer "who was A-17 last Tuesday?" and short enough to keep little.

Each run records one audit event per clinic (`retention.patient_names_cleared`)
with the number of names cleared, so a clinic can show the deletion
happened. The job never clears names on tokens from the last day, even
if a clinic sets 0 days.

The same job deletes chat messages and announcements (with their
recipient lists) older than the same period, then chats with no messages
left. It records `retention.messages_deleted` with the counts, never the
text. Chats close for new messages 2 hours after the visit ends, so
nothing is added to a chat long after the visit.

## Requests from people

| Request | How we handle it |
|---|---|
| A patient wants their name removed now | Find the token by its link or number and clear the name (RUNBOOK.md, "Common tasks"). |
| A patient asks what we hold | Their token number, service, times and (until cleared) the name they typed. |
| A staff member leaves | The clinic admin deactivates the account; sign-in stops at once. |
| A clinic leaves QueueCare | Export their reports if wanted, then delete the clinic's data. Process to be written before commercial launch. |

## Open questions for counsel

India's Digital Personal Data Protection Act, 2023 and its Rules apply.
Before commercial launch, a qualified lawyer should confirm:

1. **Notice and consent.** Is the short notice on the join screen
   enough, and does an optional first name need explicit consent?
2. **Children.** The Pediatrics queue may carry a child's name. The Act
   requires verifiable parental consent for children's data. Options:
   ask for the parent's initials instead, or take no name for children.
3. **Roles.** Is the clinic the data fiduciary and QueueCare the
   processor? This decides what the clinic contract must say.
4. **Breach notification.** Who notifies the Data Protection Board and
   the people affected, and how fast (RUNBOOK.md, "Incident response")?
5. **Where data is stored.** Confirm the hosting region and any
   cross-border transfer rules.
6. **Audit log retention.** How long staff action records must or may be
   kept.
7. **Retention period.** Confirm 30 days, or set another default.
