import type { ReactNode } from "react";
import { vi } from "vitest";
import { ShellProvider } from "@/components/shell/shell-context";
import type {
  BroadcastAudience,
  BroadcastDetail,
  BroadcastSummary,
} from "@/features/messaging/contracts";

// Test data and browser fakes for the announcement screens. Mock data only.

export const NOW = Date.parse("2026-11-01T05:00:00Z"); // 10:30 in Kolkata
export const TIMEZONE = "Asia/Kolkata";

export const GENERAL = "11111111-1111-4111-8111-111111111111";
export const BLOOD = "22222222-2222-4222-8222-222222222222";
export const BROADCAST_ID = "33333333-3333-4333-8333-333333333333";

export function audience(
  overrides: Partial<BroadcastAudience> = {},
): BroadcastAudience {
  return {
    eligible: 12,
    services: [
      { serviceId: GENERAL, name: "General", tokenPrefix: "A", eligible: 9 },
      { serviceId: BLOOD, name: "Blood test", tokenPrefix: "B", eligible: 3 },
    ],
    ...overrides,
  };
}

export function summary(
  overrides: Partial<BroadcastSummary> = {},
): BroadcastSummary {
  return {
    id: BROADCAST_ID,
    body: "The doctor is running 20 minutes late.\nSorry for the wait.",
    createdAt: new Date(NOW - 10 * 60_000).toISOString(),
    createdByName: "Asha Reception",
    serviceNames: [],
    status: "DONE",
    counts: { total: 6, pending: 0, sent: 3, skipped: 2, failed: 1, seen: 2 },
    ...overrides,
  };
}

export function detail(
  overrides: Partial<BroadcastDetail> = {},
): BroadcastDetail {
  return {
    ...summary(),
    recipients: [
      recipient("t1", "A-1", "Ravi", "SENT", { seen: true }),
      recipient("t2", "A-2", "Meena", "SENT", { seen: true }),
      recipient("t3", "A-3", null, "SENT"),
      recipient("t4", "A-4", "Kiran", "SKIPPED", { skipReason: "VISIT_ENDED" }),
      recipient("t5", "B-1", "Lata", "SKIPPED", {
        skipReason: "IN_CONSULTATION",
      }),
      recipient("t6", "B-2", "Sunil", "FAILED"),
    ],
    ...overrides,
  };
}

export function recipient(
  tokenId: string,
  tokenLabel: string,
  patientName: string | null,
  status: BroadcastDetail["recipients"][number]["status"],
  extra: Partial<BroadcastDetail["recipients"][number]> = {},
): BroadcastDetail["recipients"][number] {
  return {
    tokenId,
    tokenLabel,
    patientName,
    serviceName: tokenLabel.startsWith("B") ? "Blood test" : "General",
    status,
    skipReason: null,
    seen: false,
    ...extra,
  };
}

export function respond(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

export function apiError(code: string, message: string, status: number) {
  return respond({ error: { code, message } }, status);
}

export type Call = { url: string; method: string; body: unknown };

// fetch stub that records calls and answers through `handler`.
export function stubFetch(handler: (call: Call) => Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const call = {
        url,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

// Minimal EventSource: tests push events with emit().
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data?: unknown) {
    const event = new MessageEvent(type, {
      data: data === undefined ? undefined : JSON.stringify(data),
    });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

export function withShell(children: ReactNode) {
  return (
    <ShellProvider
      info={{ homeHref: "/receptionist", now: NOW, timezone: TIMEZONE }}
    >
      {children}
    </ShellProvider>
  );
}
