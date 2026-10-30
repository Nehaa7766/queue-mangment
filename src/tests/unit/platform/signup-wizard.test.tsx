import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignupWizard } from "@/components/onboarding/signup-wizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function respond(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.includes("sharma-clinic")
        ? respond({ slug: "sharma-clinic", available: true })
        : respond({
            slug: "taken-clinic",
            available: false,
            reason: "That address is taken. Try another.",
          }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard", () => {
  it("checks the first step before moving on", () => {
    render(<SignupWizard />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "Step 1 of 3: Clinic" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the clinic's name.")).toBeInTheDocument();
  });

  it("suggests an address from the clinic name and confirms it's free", async () => {
    render(<SignupWizard />);

    fireEvent.change(screen.getByLabelText("Clinic name"), {
      target: { value: "Sharma Clinic" },
    });

    expect(screen.getByLabelText("Public address")).toHaveValue(
      "sharma-clinic",
    );
    expect(
      await screen.findByText("Available", {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it("won't continue with a taken address", async () => {
    render(<SignupWizard />);
    // A first, empty attempt leaves an address error that must not hide the
    // "taken" message once the address is filled in from the name.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Clinic name"), {
      target: { value: "Taken Clinic" },
    });
    await screen.findByText(
      "That address is taken. Try another.",
      {},
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "Step 1 of 3: Clinic" }),
    ).toBeInTheDocument();
  });

  it("moves to the service step once the clinic step is valid", async () => {
    render(<SignupWizard />);
    fireEvent.change(screen.getByLabelText("Clinic name"), {
      target: { value: "Sharma Clinic" },
    });
    await screen.findByText("Available", {}, { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", { name: "Step 2 of 3: First service" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First service")).toHaveValue("General");
  });
});
