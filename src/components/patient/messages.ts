import type { QueueStatus } from "@/features/queue/queue-rules";
import type { TokenStatus } from "@/features/queue/token-status";

// Every patient-facing string lives here so Hindi and Marathi can be added
// later. Assumption: the language toggle is not in v1 (docs/PLAN.md §12.14).
export const messages = {
  patientTag: "Patient queue",

  clinic: {
    openNow: "Open now",
    closedNow: "Closed now",
    closedBanner:
      "The clinic is closed right now, so the queue isn't taking new patients.",
    chooseService: "Choose a service",
    chooseServiceHint:
      "Pick what you're here for. You'll confirm before joining.",
    noServices:
      "No services are taking patients right now. Please speak to reception.",
    waiting: (count: number) =>
      count === 1 ? "1 person waiting" : `${count} people waiting`,
    noQueueToday: "Not taking patients today",
    notFoundTitle: "We couldn't find this clinic",
    notFoundBody: "Check the link, or scan the QR code at the clinic again.",
  },

  queueStatus: {
    OPEN: "Open",
    PAUSED: "Paused",
    CLOSED: "Closed",
  } satisfies Record<QueueStatus, string>,

  join: {
    title: "Join the queue",
    currentWait: "Current wait",
    peopleWaiting: "People waiting",
    detailsHeading: "Your details",
    nameLabel: "First name or initials (optional)",
    nameHint: "Reception uses this to call you. You can leave it blank.",
    nameTooLong: "Please use 80 characters or fewer.",
    privacy:
      "We only ask for a first name or initials so reception can call you. We don't ask for your phone number or any medical details.",
    submit: "Join queue",
    submitting: "Joining…",
    back: "Back to services",
    pausedNotice:
      "This queue is paused for a few minutes. Please try again shortly.",
    closedNotice:
      "This queue isn't taking new patients right now. Please speak to reception.",
    clinicClosedNotice:
      "The clinic is closed right now. Please come back during opening hours.",
    errors: {
      QUEUE_PAUSED:
        "This queue is paused for a few minutes. Please try again shortly.",
      QUEUE_CLOSED:
        "This queue isn't taking new patients right now. Please speak to reception.",
      RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
      VALIDATION_ERROR: "Please check the name you entered and try again.",
      IDEMPOTENCY_CONFLICT: "Something changed. Please tap Join queue again.",
      NETWORK_ERROR:
        "We couldn't reach the clinic. Check your connection and try again.",
      default: "Something went wrong. Please try again.",
    },
  },

  token: {
    yourToken: "Your token",
    aheadLabel: "Ahead of you",
    statusLabel: {
      WAITING: "Waiting",
      CALLED: "Called",
      IN_SERVICE: "In consultation",
      COMPLETED: "Done",
      SKIPPED: "Skipped",
      CANCELLED: "Cancelled",
    } satisfies Record<TokenStatus, string>,
    waitingTitle: "You're in the queue",
    nextTitle: "You're next",
    peopleAhead: (count: number) =>
      count === 1 ? "1 person ahead of you" : `${count} people ahead of you`,
    nextBody: "Please stay close to reception.",
    estimateLabel: "Estimated wait",
    roughEstimate: "Rough estimate",
    estimateNote: "This is an estimate, not a promise.",
    calledTitle: "It's your turn",
    calledBody: "Please go to reception now.",
    inServiceTitle: "You're with the doctor",
    inServiceBody: "Your consultation has started.",
    completedTitle: "Visit completed",
    completedBody: (clinicName: string) =>
      `Thank you for visiting ${clinicName}.`,
    skippedTitle: "You missed your turn",
    skippedBody:
      "Please speak to reception. They can put you back in the queue.",
    cancelledTitle: "You've left the queue",
    cancelledBody: "This token is no longer active.",
    pausedBanner: "The queue is paused for a moment. You keep your place.",
    closedBanner: "This queue has closed for today. Please speak to reception.",
    updatedJustNow: "Updated just now",
    updatedMinutesAgo: (minutes: number) =>
      minutes === 1 ? "Updated 1 min ago" : `Updated ${minutes} min ago`,
    refreshFailed: "Couldn't refresh. We'll keep trying.",
    notFoundTitle: "We couldn't find this token",
    notFoundBody:
      "Check the link, or scan the QR code at the clinic to join again.",
    keepPageOpen: "Keep this page open. It updates by itself.",
  },

  cancel: {
    trigger: "Leave the queue",
    title: "Leave the queue?",
    body: "You'll lose your place. To come back, you'll need to join again and wait from the end.",
    confirm: "Leave queue",
    keep: "Stay in queue",
    done: "You've left the queue.",
    failed: "We couldn't remove you from the queue. Please try again.",
  },
} as const;
