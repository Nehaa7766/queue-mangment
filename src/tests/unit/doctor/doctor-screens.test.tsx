import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityQuickToggle } from "@/components/doctor/availability-quick-toggle";
import {
  DoctorConsultation,
  DoctorDashboard,
} from "@/components/doctor/doctor-screens";
import { NOW, panelView, staffToken } from "./fixtures";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));
const { toast } = await import("sonner");

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const started = staffToken({
  id: "17",
  status: "IN_SERVICE",
  serviceStartedAt: new Date(NOW).toISOString(),
  assignedDoctorName: "Dr. Shah",
});

describe("DoctorConsultation", () => {
  it("starts a called patient and shows the consultation", async () => {
    let resolveStart!: (response: Response) => void;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => (resolveStart = resolve));
      }
      return respond(200, panelView({ current: started, called: [] }));
    });
    render(<DoctorConsultation initialView={panelView()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Start consultation with A-17/ }),
    );

    // Optimistic: the ticket appears before the server answers.
    expect(
      screen.getByRole("region", { name: "Current consultation" }),
    ).toHaveTextContent("A-17");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tokens/17/start",
      expect.objectContaining({ method: "POST" }),
    );

    resolveStart(
      new Response(JSON.stringify({ token: started }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Consultation started with A-17 · Patient 17.",
      ),
    );
    expect(
      screen.getByRole("button", { name: /Complete consultation/ }),
    ).toBeInTheDocument();
  });

  it("rolls back and warns when another doctor got there first", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? respond(409, {
            error: {
              code: "INVALID_STATE_TRANSITION",
              message: "This token was just updated by someone else.",
              requestId: "r",
            },
          })
        : respond(200, panelView()),
    );
    render(<DoctorConsultation initialView={panelView()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Start consultation with A-17/ }),
    );

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "This token was just updated by someone else. The list has been refreshed.",
      ),
    );
    expect(
      screen.queryByRole("region", { name: "Current consultation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start consultation with A-17/ }),
    ).toBeEnabled();
  });

  it("completes the current consultation", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? respond(200, { token: { ...started, status: "COMPLETED" } })
        : respond(200, panelView({ called: [] })),
    );
    render(
      <DoctorConsultation
        initialView={panelView({ current: started, called: [] })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Complete consultation/ }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Consultation with A-17 · Patient 17 completed.",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tokens/17/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByText(/No consultation in progress/)).toBeInTheDocument();
  });
});

describe("DoctorDashboard", () => {
  it("shows today's numbers and who is up next", () => {
    render(<DoctorDashboard initialView={panelView()} />);

    expect(screen.getByText("Seen today").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("9m")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /General/ })).toHaveTextContent(
      "A-18",
    );
  });
});

describe("AvailabilityQuickToggle", () => {
  it("starts a 15-minute break", async () => {
    const onChange = vi.fn();
    const doctor = {
      name: "Dr. Shah",
      availability: "ON_BREAK" as const,
      delayMinutes: 15,
      note: null,
      updatedAt: new Date(NOW).toISOString(),
    };
    fetchMock.mockReturnValue(respond(200, { doctor }));
    render(
      <AvailabilityQuickToggle
        doctor={{ ...doctor, availability: "AVAILABLE", delayMinutes: 0 }}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Take a 15-min break" }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(doctor));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/doctor/availability",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          availability: "ON_BREAK",
          delayMinutes: 15,
          note: null,
        }),
      }),
    );
  });
});
