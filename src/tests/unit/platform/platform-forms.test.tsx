import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddClinicButton } from "@/components/platform/clinic-forms";
import { AddAdminButton } from "@/components/platform/user-forms";
import {
  adminCreateSchema,
  clinicCreateSchema,
} from "@/features/platform/schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const { toast } = await import("sonner");

function respond(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

// The API parses the body with the same schema the form used, as the route
// handlers do, so a body that only the browser accepts fails here too.
const INVALID = {
  error: {
    code: "VALIDATION_ERROR",
    message: "Some fields are missing or invalid.",
  },
};

type Call = { url: string; method: string; body: unknown };
let calls: Call[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (url.startsWith("/api/platform/clinics/slug")) {
        return respond({ slug: "x", available: true });
      }
      if (url === "/api/platform/clinics" && method === "POST") {
        const parsed = clinicCreateSchema.safeParse(calls.at(-1)?.body);
        if (!parsed.success) return respond(INVALID, 400);
        if (parsed.data.slug === "taken-clinic") {
          return respond(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "That address is taken. Try another.",
              },
            },
            400,
          );
        }
        return respond(
          {
            clinicId: "c1",
            slug: "sharma-clinic",
            admin: {
              kind: "invited",
              email: "asha@example.test",
              acceptUrl: "http://localhost/accept-invite/abc",
            },
          },
          201,
        );
      }
      if (url === "/api/platform/users" && method === "POST") {
        if (!adminCreateSchema.safeParse(calls.at(-1)?.body).success) {
          return respond(INVALID, 400);
        }
        return respond(
          {
            kind: "invited",
            email: "ravi@example.test",
            clinicName: "Sharma Clinic",
            acceptUrl: "http://localhost/accept-invite/def",
          },
          201,
        );
      }
      return respond({ error: { code: "NOT_FOUND", message: "Nope" } }, 404);
    }),
  );
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const posts = () => calls.filter((call) => call.method !== "GET");

function fill(label: string, value: string, exact = true) {
  fireEvent.change(screen.getByLabelText(label, { exact }), {
    target: { value },
  });
}

describe("AddClinicButton", () => {
  it("sends the new clinic and shows the invitation link", async () => {
    render(<AddClinicButton />);
    fireEvent.click(screen.getByRole("button", { name: "Add clinic" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a clinic" });

    fill("Clinic name", "Sharma Clinic");
    expect(screen.getByLabelText("Public address")).toHaveValue(
      "sharma-clinic",
    );
    fill("Name", "Asha Admin");
    fill("Email", "asha@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add clinic" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({
      url: "/api/platform/clinics",
      body: {
        name: "Sharma Clinic",
        slug: "sharma-clinic",
        timezone: "Asia/Kolkata",
        status: "ACTIVE",
        clinicType: "GENERAL",
        email: null,
        address: null,
        phone: null,
        city: null,
        state: null,
        pinCode: null,
        hours: {
          openingTime: "09:00",
          closingTime: "18:00",
          workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
        },
        serviceName: "General",
        tokenPrefix: "A",
        adminName: "Asha Admin",
        adminEmail: "asha@example.test",
      },
    });
    expect(
      await screen.findByRole("dialog", { name: "Clinic added" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Invitation link")).toHaveValue(
      "http://localhost/accept-invite/abc",
    );
    // The sheet itself confirms; a toast would sit over its Done button.
    expect(toast.success).not.toHaveBeenCalled();
    expect(posts()[0].body).not.toHaveProperty("logo");
  });

  it("sends the profile, hours and chosen working days", async () => {
    render(<AddClinicButton />);
    fireEvent.click(screen.getByRole("button", { name: "Add clinic" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a clinic" });

    fill("Clinic name", "Sharma Clinic");
    fill("Clinic type", "DENTAL");
    fill("Status", "INACTIVE");
    fill("Clinic email (optional)", "front@sharma.example");
    fill("City (optional)", "Pune");
    fill("State (optional)", "Maharashtra");
    fill("PIN code (optional)", "411001");
    fill("Opening time", "10:00");
    fill("Closing time", "17:30");
    fireEvent.click(screen.getByLabelText("Saturday"));
    fill("Name", "Asha Admin");
    fill("Email", "asha@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add clinic" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({
      status: "INACTIVE",
      clinicType: "DENTAL",
      email: "front@sharma.example",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      hours: {
        openingTime: "10:00",
        closingTime: "17:30",
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    });
  });

  it("marks a bad field, says so by the button and focuses it", async () => {
    render(<AddClinicButton />);
    fireEvent.click(screen.getByRole("button", { name: "Add clinic" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a clinic" });

    fill("Clinic name", "Sharma Clinic");
    fill("PIN code (optional)", "12");
    fill("Name", "Asha Admin");
    fill("Email", "asha@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add clinic" }));

    expect(
      await within(sheet).findByText(
        "Some details need fixing. They're marked in red.",
      ),
    ).toBeInTheDocument();
    const pin = screen.getByLabelText("PIN code (optional)");
    expect(pin).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a 6-digit PIN code, e.g. 411001."),
    ).toBeInTheDocument();
    await waitFor(() => expect(pin).toHaveFocus());
    expect(posts()).toHaveLength(0);
  });

  it("keeps the sheet open and shows the server's error in it", async () => {
    render(<AddClinicButton />);
    fireEvent.click(screen.getByRole("button", { name: "Add clinic" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a clinic" });

    fill("Clinic name", "Taken Clinic");
    fill("Name", "Asha Admin");
    fill("Email", "asha@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add clinic" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "That address is taken. Try another.",
    );
    expect(posts()).toHaveLength(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Clinic name")).toHaveValue("Taken Clinic");
  });

  it("shows what's missing instead of sending", async () => {
    render(<AddClinicButton />);
    fireEvent.click(screen.getByRole("button", { name: "Add clinic" }));
    const sheet = await screen.findByRole("dialog", { name: "Add a clinic" });

    fireEvent.click(within(sheet).getByRole("button", { name: "Add clinic" }));

    expect(
      await screen.findByText("Enter the clinic's name."),
    ).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });
});

describe("AddAdminButton", () => {
  const clinics = [
    { id: "6f1c2b6e-8a51-4a43-9b8f-2a7f1c9f3d10", name: "Sharma Clinic" },
    { id: "0a7f2c1e-5b3d-4e8f-9a6b-1c2d3e4f5a6b", name: "Mehta Clinic" },
  ];

  it("asks for a clinic, then sends the admin", async () => {
    render(<AddAdminButton clinics={clinics} />);
    fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Add a clinic admin",
    });

    fill("Name", "Ravi Admin");
    fill("Email", "ravi@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add admin" }));
    expect(await screen.findByText("Choose a clinic.")).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        "Some details need fixing. They're marked in red.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Clinic")).toHaveFocus());
    expect(posts()).toHaveLength(0);

    fill("Clinic", clinics[0].id);
    fireEvent.click(within(sheet).getByRole("button", { name: "Add admin" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toMatchObject({
      url: "/api/platform/users",
      body: {
        name: "Ravi Admin",
        email: "ravi@example.test",
        clinicId: clinics[0].id,
      },
    });
    expect(
      await screen.findByRole("dialog", { name: "Admin added" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Invitation link")).toHaveValue(
      "http://localhost/accept-invite/def",
    );
  });

  it("chooses the only clinic there is", async () => {
    render(<AddAdminButton clinics={clinics.slice(0, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
    await screen.findByRole("dialog", { name: "Add a clinic admin" });

    expect(screen.getByLabelText("Clinic")).toHaveValue(clinics[0].id);
  });

  it("fixes the clinic on a clinic's own page", async () => {
    render(<AddAdminButton clinics={clinics} clinicId={clinics[0].id} />);
    fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Add a clinic admin",
    });

    expect(within(sheet).queryByLabelText("Clinic")).toBeNull();
    fill("Name", "Ravi Admin");
    fill("Email", "ravi@example.test");
    fireEvent.click(within(sheet).getByRole("button", { name: "Add admin" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({ clinicId: clinics[0].id });
  });
});
