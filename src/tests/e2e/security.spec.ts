import { expect, test } from "@playwright/test";

// Headers and access rules don't depend on screen width; check them once.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "Runs once, at desktop");
});

for (const path of ["/", "/login", "/api/health"]) {
  test(`security headers on ${path}`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    const csp = headers["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The production build never needs eval (development adds it for React).
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("same-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("staff endpoints refuse requests without a session", async ({
  request,
}) => {
  const clinic = await (
    await request.get("/api/public/clinics/demo-clinic")
  ).json();
  const queueId = clinic.services.find(
    (service: { queue: { queueId: string } | null }) => service.queue,
  ).queue.queueId;

  const response = await request.post(`/api/queues/${queueId}/call-next`);

  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
});

test("the public health check reveals nothing beyond its status", async ({
  request,
}) => {
  const body = await (await request.get("/api/health")).json();

  expect(Object.keys(body).sort()).toEqual(["database", "status"]);
});

test("internal jobs refuse requests without the job token", async ({
  request,
}) => {
  const response = await request.post("/api/internal/retention/run", {
    headers: { authorization: "Bearer not-the-secret" },
  });

  // 401 when the server has a job secret, 503 when it has none.
  expect([401, 503]).toContain(response.status());
});
