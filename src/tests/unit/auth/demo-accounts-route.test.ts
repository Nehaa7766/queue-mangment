import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/demo-accounts/route";
import { demoLoginsEnabled } from "@/lib/auth/demo-accounts";

// connection() only works inside a real Next.js request.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/lib/auth/demo-accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/demo-accounts")>()),
  demoLoginsEnabled: vi.fn(),
}));

async function getList() {
  const response = await GET(
    new Request("http://localhost/api/demo-accounts"),
    {
      params: Promise.resolve({}),
    },
  );
  return { response, body: await response.json() };
}

describe("GET /api/demo-accounts", () => {
  it("lists the demo accounts and password when enabled", async () => {
    vi.mocked(demoLoginsEnabled).mockReturnValue(true);

    const { response, body } = await getList();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.password).toBe("queuecare-dev");
    expect(body.accounts).toHaveLength(4);
  });

  it("gives an empty list and no password when disabled", async () => {
    vi.mocked(demoLoginsEnabled).mockReturnValue(false);

    const { body } = await getList();

    expect(body).toEqual({ accounts: [], password: null });
  });
});
