import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getDashboard } from "@/app/api/clinics/[clinicId]/dashboard/route";
import { GET as getTodayQueues } from "@/app/api/clinics/[clinicId]/queues/today/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getPublicToken } from "@/app/api/public/tokens/[publicTokenId]/route";
import { POST as callNext } from "@/app/api/queues/[queueId]/call-next/route";
import { POST as pauseQueue } from "@/app/api/queues/[queueId]/pause/route";
import {
  GET as getQueueTokens,
  POST as joinQueue,
} from "@/app/api/queues/[queueId]/tokens/route";
import { POST as createWalkIn } from "@/app/api/queues/[queueId]/walk-ins/route";
import { POST as tokenAction } from "@/app/api/tokens/[tokenId]/[action]/route";
import { IDEMPOTENCY_KEY_HEADER } from "@/features/queue/contracts";
import { getDb } from "@/lib/db";
import {
  actAs,
  createClinicFixture,
  deleteClinicFixtures,
  type ClinicFixture,
} from "../queue/fixtures";

// Needs the test database with migrations applied.
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
// connection() only works inside a real Next.js request.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const JOB_SECRET = "security-test-secret-0123456789abcdef";
process.env.INTERNAL_JOB_SECRET = JOB_SECRET;

let clinic: ClinicFixture;
let other: ClinicFixture;

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
});

afterAll(async () => {
  await deleteClinicFixtures([clinic, other]);
});

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

function request(
  method: "GET" | "POST",
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Request {
  return new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function join(ip = "198.51.100.1", patientName?: string) {
  return joinQueue(
    request("POST", {
      body: patientName ? { patientName } : undefined,
      headers: {
        [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
        "x-forwarded-for": ip,
      },
    }),
    params({ queueId: clinic.queue.id }),
  );
}

describe("tenant isolation", () => {
  // Every staff endpoint, called by a receptionist of a different clinic.
  const crossClinicCalls: [string, () => Promise<Response>][] = [
    [
      "live queue",
      () =>
        getQueueTokens(request("GET"), params({ queueId: clinic.queue.id })),
    ],
    [
      "call next",
      () => callNext(request("POST"), params({ queueId: clinic.queue.id })),
    ],
    [
      "pause",
      () => pauseQueue(request("POST"), params({ queueId: clinic.queue.id })),
    ],
    [
      "walk-in",
      () =>
        createWalkIn(
          request("POST", {
            body: { patientName: "Intruder" },
            headers: { [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID() },
          }),
          params({ queueId: clinic.queue.id }),
        ),
    ],
    [
      "today's queues",
      () =>
        getTodayQueues(request("GET"), params({ clinicId: clinic.clinic.id })),
    ],
    [
      "dashboard",
      () =>
        getDashboard(request("GET"), params({ clinicId: clinic.clinic.id })),
    ],
  ];

  for (const [name, call] of crossClinicCalls) {
    it(`another clinic's staff get 403 on ${name}`, async () => {
      actAs(other.receptionist);

      const response = await call();

      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    });

    it(`a signed-out caller gets 401 on ${name}`, async () => {
      actAs(null);

      const response = await call();

      expect(response.status).toBe(401);
    });
  }

  it("another clinic's staff can't act on a token", async () => {
    const joined = await join("198.51.100.2");
    const { id: tokenId } = await getDb().queueToken.findUniqueOrThrow({
      where: { publicTokenId: (await joined.json()).token.publicTokenId },
      select: { id: true },
    });
    actAs(other.receptionist);

    const response = await tokenAction(
      request("POST"),
      params({ tokenId, action: "skip" }),
    );

    expect(response.status).toBe(403);
  });
});

describe("public endpoints", () => {
  it("the token status returns only the minimum fields", async () => {
    const joined = await join("198.51.100.3", "Priya Sharma");
    const { publicTokenId } = (await joined.json()).token;

    const response = await getPublicToken(
      request("GET"),
      params({ publicTokenId }),
    );
    const { token } = await response.json();

    // Only fields from PublicTokenView in contracts.ts may appear.
    const allowed = new Set([
      "calledAt",
      "clinicName",
      "clinicSlug",
      "doctorNotice",
      "estimate",
      "peopleAhead",
      "publicTokenId",
      "queueStatus",
      "serviceName",
      "status",
      "tokenLabel",
      "updatedAt",
    ]);
    expect(Object.keys(token).filter((key) => !allowed.has(key))).toEqual([]);
    // No patient name and no internal ids, even though the token has a name.
    expect(JSON.stringify(token)).not.toContain("Priya");
    expect(JSON.stringify(token)).not.toContain(clinic.clinic.id);
    expect(JSON.stringify(token)).not.toContain(clinic.queue.id);
  });

  it("joining answers 429 after 20 requests a minute from one address", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    for (let attempt = 0; attempt < 20; attempt++) {
      expect((await join(ip)).status).toBe(201);
    }

    const limited = await join(ip);

    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("RATE_LIMITED");
    // Other addresses are still served.
    expect((await join("198.51.100.4")).status).toBe(201);
  });

  it("the health check shows outbox counts only with the job token", async () => {
    const anonymous = await (await getHealth(request("GET"), {})).json();
    const monitoring = await (
      await getHealth(
        request("GET", { headers: { authorization: `Bearer ${JOB_SECRET}` } }),
        {},
      )
    ).json();

    expect(anonymous).toEqual({ status: "ok", database: "ok" });
    expect(monitoring).toMatchObject({ status: "ok", database: "ok" });
    expect(Object.keys(monitoring.outbox).sort()).toEqual([
      "failed",
      "oldestPendingAgeSeconds",
      "pending",
    ]);
    expect(monitoring.outbox.pending).toEqual(expect.any(Number));
    expect(monitoring.outbox.failed).toEqual(expect.any(Number));
  });
});
