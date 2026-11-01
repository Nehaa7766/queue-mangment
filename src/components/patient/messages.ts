import type { ChatCopy } from "@/components/messaging/chat-context";
import type { Channel } from "@/features/messaging/contracts";
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

  // The Messages card on the token page (docs/MESSAGING.md "Screens").
  messaging: {
    title: "Messages",
    emergency: "For questions about your visit. Not for medical emergencies.",
    tabsLabel: "Who to message",
    tabs: { RECEPTION: "Reception", DOCTOR: "Doctor" } satisfies Record<
      Channel,
      string
    >,
    unread: (count: number) =>
      count === 1 ? "1 unread message" : `${count} unread messages`,
    routing: {
      assignedDoctor: (doctorName: string) => `Answered by ${doctorName}.`,
      serviceDoctors: (serviceName: string) =>
        `Answered by the ${serviceName} doctors.`,
      receptionFallback: "Reception is answering for the doctor.",
    },
    empty: {
      RECEPTION: {
        title: "No messages yet",
        body: "Ask reception about your visit, for example if you're running late.",
      },
      DOCTOR: {
        title: "No messages yet",
        body: "Ask a question about your visit before you see the doctor.",
      },
    } satisfies Record<Channel, { title: string; body: string }>,
    closed:
      "This chat has closed. You can still read it. Please speak to reception if you need help.",
    loading: "Loading messages…",
    summaryFailed: "We couldn't load your messages.",
    retry: "Try again",
    // Staff messages without a name.
    clinic: "Clinic",
    // Token page: the entry card, the top button and the new-message bar.
    intro: "Chat privately with the clinic. Only you and the clinic see it.",
    rowHint: {
      RECEPTION: "Your turn, running late, or questions about the queue",
      DOCTOR: "Questions for the doctor about your visit",
    } satisfies Record<Channel, string>,
    open: "Messages",
    newMessage: (who: string) => `New message from ${who}`,
    view: "View",
    // Chat screen.
    back: "Back to your token",
    tokenLine: (clinicName: string, tokenLabel: string) =>
      `${clinicName} · Token ${tokenLabel}`,
    chatTitle: {
      assignedDoctor: (doctorName: string) => doctorName,
      serviceDoctors: (serviceName: string) => `${serviceName} doctors`,
      receptionFallback: "Reception, for the doctor",
    },
  },

  // Words for the shared chat pieces on the patient screen.
  chat: {
    status: {
      sending: "Sending",
      sent: "Sent",
      seen: "Seen",
      failed: "Not sent",
    },
    failure: {
      network: "No connection. It will send when you're back online.",
      server:
        "Something went wrong. It will try again when you're back online.",
      closed: "This chat is closed.",
      "rate-limited":
        "You've sent a lot of messages. Please wait a minute, then tap Retry.",
      forbidden: "This chat isn't available any more.",
      rejected: "Please check your message and tap Retry.",
    },
    retry: "Retry",
    remove: "Remove",
    loadOlder: "Show earlier messages",
    loadingOlder: "Loading…",
    olderFailed: "We couldn't load earlier messages.",
    history: "Message history",
    you: "You",
    announcement: "Announcement",
    jumpToLatest: "New messages",
    composer: {
      label: "Your message",
      placeholder: "Type your message…",
      send: "Send",
      hint: "Enter to send · Shift+Enter for a new line",
      tooLong: "Please keep it under 1,000 characters.",
      counter: (length: number) =>
        `${new Intl.NumberFormat("en-IN").format(length)} / 1,000`,
      closedLabel: "Chat closed",
    },
    loadFailed: {
      title: "We couldn't load your messages",
      body: "Check your connection and try again.",
      retry: "Try again",
    },
    unavailable: {
      title: "These messages aren't available",
      body: "Please speak to reception.",
    },
    connection: {
      connecting: "Connecting…",
      live: "Live",
      reconnecting: "Reconnecting…",
      offline: "Offline",
    },
    connectionNote: {
      reconnecting: "Reconnecting. New messages may take a moment.",
      offline:
        "You're offline. Your messages will send when you're back online.",
    },
    announce: {
      newMessage: (sender: string, body: string) =>
        `New message from ${sender}: ${body}`,
      sent: "Message sent",
      seen: "Message seen",
      failed: "Message not sent",
    },
  } satisfies ChatCopy,
} as const;
