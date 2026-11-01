// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/retention/run/route";
import { runRetention } from "@/features/retention/retention";
import { getEnv } from "@/lib/env";

vi.mock("@/lib/env", () => ({ getEnv: vi.fn() }));
vi.mock("@/features/retention/retention", () => ({ runRetention: vi.fn() }));

const SECRET = "job-secret-0123456789abcdef0123456789";

function run(authorization?: string) {
  return POST(
    new Request("http://test/api/internal/retention/run", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
    {},
  );
}

function configure(secret: string | undefined) {
  vi.mocked(getEnv).mockReturnValue({
    INTERNAL_JOB_SECRET: secret,
  } as ReturnType<typeof getEnv>);
}

beforeEach(() => {
  vi.mocked(runRetention).mockReset();
  vi.mocked(runRetention).mockResolvedValue({
    clinics: 2,
    patientNamesCleared: 3,
    idempotencyRecordsDeleted: 4,
    messagesDeleted: 5,
    conversationsDeleted: 6,
    broadcastsDeleted: 7,
  });
});

describe("POST /api/internal/retention/run", () => {
  it("runs the job for the configured token", async () => {
    configure(SECRET);

    const response = await run(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clinics: 2,
      patientNamesCleared: 3,
      idempotencyRecordsDeleted: 4,
      messagesDeleted: 5,
      conversationsDeleted: 6,
      broadcastsDeleted: 7,
    });
  });

  it("answers 401 and does nothing for a wrong token", async () => {
    configure(SECRET);

    const response = await run("Bearer wrong-token");

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(runRetention).not.toHaveBeenCalled();
  });

  it("answers 503 and does nothing when no job secret is set", async () => {
    configure(undefined);

    const response = await run(`Bearer ${SECRET}`);

    expect(response.status).toBe(503);
    expect(runRetention).not.toHaveBeenCalled();
  });
});
