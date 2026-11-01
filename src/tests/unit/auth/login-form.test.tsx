import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LoginForm } from "@/components/auth/login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/actions", () => ({ getHomePath: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const ENABLED = {
  accounts: [
    { role: "Reception", email: "reception@demo-clinic.test" },
    { role: "Doctor", email: "doctor@demo-clinic.test" },
  ],
  password: "queuecare-dev",
};

function serveDemoList(body: unknown) {
  const fetchMock = vi.fn(async () => Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderWithDemo() {
  render(
    <LoginForm>
      <DemoAccounts />
    </LoginForm>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm demo accounts", () => {
  it("asks the server for the list and shows nothing when it's empty", async () => {
    const fetchMock = serveDemoList({ accounts: [], password: null });
    renderWithDemo();

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/demo-accounts",
        expect.anything(),
      ),
    );
    expect(
      screen.queryByRole("region", { name: /demo accounts/i }),
    ).not.toBeInTheDocument();
  });

  it("fills the form from a demo account without submitting", async () => {
    serveDemoList(ENABLED);
    renderWithDemo();

    fireEvent.click(await screen.findByRole("button", { name: /^Doctor/ }));

    expect(screen.getByLabelText("Email")).toHaveValue(
      "doctor@demo-clinic.test",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("queuecare-dev");
    expect(
      screen.getByRole("button", { name: "Open my counter" }),
    ).toHaveFocus();
  });

  it("names the box so it doesn't match the password field's label", async () => {
    serveDemoList(ENABLED);
    renderWithDemo();

    expect(
      await screen.findByRole("region", { name: "Demo accounts" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Password")).toHaveLength(1);
  });

  it("shows nothing outside a sign-in form", async () => {
    const fetchMock = serveDemoList(ENABLED);
    render(<DemoAccounts />);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
