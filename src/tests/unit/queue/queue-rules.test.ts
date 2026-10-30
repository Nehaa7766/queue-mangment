import { describe, expect, it } from "vitest";
import {
  assertCanCallNext,
  assertCanJoin,
  assertDoctorFree,
} from "@/features/queue/queue-rules";
import { errorCodeOf } from "./helpers";

const openQueue = {
  queueStatus: "OPEN" as const,
  serviceActive: true,
  waitingCount: 3,
  maxQueueSize: null,
};

describe("assertCanJoin", () => {
  it("allows joining an open queue for an active service", () => {
    expect(errorCodeOf(() => assertCanJoin(openQueue))).toBeNull();
  });

  it("rejects a paused queue", () => {
    expect(
      errorCodeOf(() => assertCanJoin({ ...openQueue, queueStatus: "PAUSED" })),
    ).toBe("QUEUE_PAUSED");
  });

  it("rejects a closed queue", () => {
    expect(
      errorCodeOf(() => assertCanJoin({ ...openQueue, queueStatus: "CLOSED" })),
    ).toBe("QUEUE_CLOSED");
  });

  it("reports a closed queue even when the service is also inactive", () => {
    expect(
      errorCodeOf(() =>
        assertCanJoin({
          ...openQueue,
          queueStatus: "CLOSED",
          serviceActive: false,
        }),
      ),
    ).toBe("QUEUE_CLOSED");
  });

  it("rejects an inactive service", () => {
    expect(
      errorCodeOf(() => assertCanJoin({ ...openQueue, serviceActive: false })),
    ).toBe("QUEUE_CLOSED");
  });

  it("allows joining below the size limit", () => {
    expect(
      errorCodeOf(() =>
        assertCanJoin({ ...openQueue, waitingCount: 9, maxQueueSize: 10 }),
      ),
    ).toBeNull();
  });

  it("rejects joining at the size limit", () => {
    expect(
      errorCodeOf(() =>
        assertCanJoin({ ...openQueue, waitingCount: 10, maxQueueSize: 10 }),
      ),
    ).toBe("QUEUE_CLOSED");
  });
});

describe("assertCanCallNext", () => {
  it("allows calling from an open queue", () => {
    expect(errorCodeOf(() => assertCanCallNext("OPEN"))).toBeNull();
  });

  it("blocks calling from a paused queue", () => {
    expect(errorCodeOf(() => assertCanCallNext("PAUSED"))).toBe("QUEUE_PAUSED");
  });

  it("blocks calling from a closed queue", () => {
    expect(errorCodeOf(() => assertCanCallNext("CLOSED"))).toBe("QUEUE_CLOSED");
  });
});

describe("assertDoctorFree", () => {
  it("allows starting when the doctor has no active consultation", () => {
    expect(errorCodeOf(() => assertDoctorFree(0))).toBeNull();
  });

  it("blocks a second active consultation", () => {
    expect(errorCodeOf(() => assertDoctorFree(1))).toBe(
      "INVALID_STATE_TRANSITION",
    );
  });
});
