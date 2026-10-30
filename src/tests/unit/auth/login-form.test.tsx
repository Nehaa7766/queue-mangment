import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/actions", () => ({ getHomePath: vi.fn() }));
vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const DEMO = {
  accounts: [
    { role: "Reception", email: "reception@demo-clinic.test" },
    { role: "Doctor", email: "doctor@demo-clinic.test" },
  ],
  password: "queuecare-dev",
};

describe("LoginForm demo accounts", () => {
  it("shows no demo accounts unless given some", () => {
    render(<LoginForm />);

    expect(
      screen.queryByRole("region", { name: /demo accounts/i }),
    ).not.toBeInTheDocument();
  });

  it("fills the form from a demo account without submitting", () => {
    render(<LoginForm demo={DEMO} />);

    fireEvent.click(screen.getByRole("button", { name: /^Doctor/ }));

    expect(screen.getByLabelText("Email")).toHaveValue(
      "doctor@demo-clinic.test",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("queuecare-dev");
    expect(
      screen.getByRole("button", { name: "Open my counter" }),
    ).toHaveFocus();
  });
});

it("names the demo box so it doesn't match the password field's label", () => {
  render(<LoginForm demo={DEMO} />);

  expect(
    screen.getByRole("region", { name: "Demo accounts" }),
  ).toBeInTheDocument();
  expect(screen.getAllByLabelText("Password")).toHaveLength(1);
});
