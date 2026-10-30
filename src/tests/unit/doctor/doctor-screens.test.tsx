import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityQuickToggle } from "@/components/doctor/availability-quick-toggle";
import {
  DoctorConsultation,
  DoctorDashboard,
  DoctorQueueBoard,
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

// 05:30–05:42 UTC is 11:00–11:12 in Asia/Kolkata.
const finished = staffToken({
  id: "15",
  status: "COMPLETED",
  serviceStartedAt: "2026-10-30T05:30:00Z",
  completedAt: "2026-10-30T05:42:00Z",
  assignedDoctorName: "Dr. Shah",
});

const fiveWaiting = Array.from({ length: 5 }, (_, i) =>
  staffToken({ id: String(20 + i) }),
);

function withFiveWaiting() {
  const view = panelView({ waiting: fiveWaiting, waitingCount: 5 });
  return {
    ...view,
    services: [{ ...view.services[0], waitingCount: 5 }],
  };
}

describe("DoctorDashboard", () => {
  it("shows today's numbers", () => {
    render(<DoctorDashboard initialView={panelView()} />);
    const glance = screen.getByRole("region", { name: "Today at a glance" });

    expect(
      within(glance).getByText("Seen today").previousElementSibling,
    ).toHaveTextContent("3");
    expect(within(glance).getByText("9 min")).toBeInTheDocument();
  });

  it("lists every waiting patient, with no limit", () => {
    render(<DoctorDashboard initialView={withFiveWaiting()} />);

    // A called patient is ready, so the Called tab opens first.
    expect(screen.getByRole("tab", { name: /Called/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: /Waiting/ }));

    const general = screen.getByRole("region", { name: /General/ });
    for (const token of fiveWaiting) {
      expect(general).toHaveTextContent(token.tokenLabel);
    }
    expect(within(general).getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows the doctor's finished consultations under Done today", () => {
    render(
      <DoctorDashboard
        initialView={panelView({ completedToday: [finished] })}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Done today/ }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("A-15");
    expect(panel).toHaveTextContent("11:00–11:12");
    expect(panel).toHaveTextContent("12 min");
  });

  it("moves between tabs with the arrow keys", () => {
    render(<DoctorDashboard initialView={panelView()} />);

    fireEvent.keyDown(screen.getByRole("tab", { name: /Called/ }), {
      key: "ArrowRight",
    });

    const waiting = screen.getByRole("tab", { name: /Waiting/ });
    expect(waiting).toHaveAttribute("aria-selected", "true");
    expect(waiting).toHaveFocus();
  });

  it("puts the consultation in progress, with Complete, in the highlight", () => {
    render(
      <DoctorDashboard
        initialView={panelView({
          current: staffToken({
            id: "16",
            status: "IN_SERVICE",
            serviceStartedAt: new Date(NOW - 7 * 60_000).toISOString(),
          }),
        })}
      />,
    );

    const highlight = screen.getByRole("region", { name: "In consultation" });
    expect(highlight).toHaveTextContent("A-16");
    expect(highlight).toHaveTextContent("7 min");
    expect(
      within(highlight).getByRole("button", { name: /Complete consultation/ }),
    ).toBeEnabled();
  });
});

describe("DoctorQueueBoard", () => {
  const view = panelView({
    inService: [
      staffToken({
        id: "14",
        status: "IN_SERVICE",
        serviceStartedAt: new Date(NOW - 4 * 60_000).toISOString(),
        assignedDoctorName: "Dr. Rao",
      }),
    ],
    completedToday: [finished],
  });

  it("lists every patient in one table", () => {
    render(<DoctorQueueBoard initialView={view} />);
    const table = screen.getByRole("table");

    // Header row plus in consultation, called, two waiting and one done.
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    for (const label of ["A-14", "A-17", "A-18", "A-19", "A-15"]) {
      expect(table).toHaveTextContent(label);
    }
    expect(table).toHaveTextContent("with Dr. Rao");
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("5");
  });

  it("filters by status, keeping Start on called patients", () => {
    render(<DoctorQueueBoard initialView={view} />);

    fireEvent.click(screen.getByRole("tab", { name: /Called/ }));

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Start consultation with A-17/ }),
    ).toBeEnabled();
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

describe("In consultation to Done today", () => {
  // Started 05:53 UTC (11:23 in Asia/Kolkata); completed at NOW, 11:30.
  const inConsultation = staffToken({
    id: "16",
    status: "IN_SERVICE",
    serviceStartedAt: new Date(NOW - 7 * 60_000).toISOString(),
    assignedDoctorName: "Dr. Shah",
  });
  const consulting = panelView({
    current: inConsultation,
    inService: [inConsultation],
    completedToday: [finished],
  });
  const completedView = panelView({
    completedToday: [
      {
        ...inConsultation,
        status: "COMPLETED",
        completedAt: new Date(NOW).toISOString(),
      },
      finished,
    ],
    seenToday: 4,
  });
  const tab = (name: RegExp) => screen.getByRole("tab", { name });
  const completeInHighlight = () =>
    within(screen.getByRole("region", { name: "In consultation" })).getByRole(
      "button",
      { name: /Complete consultation/ },
    );

  it("moves the patient on the dashboard before the server answers", async () => {
    let resolveComplete!: (response: Response) => void;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((r) => (resolveComplete = r))
        : respond(200, completedView),
    );
    render(<DoctorDashboard initialView={consulting} />);
    expect(tab(/In consultation/)).toHaveTextContent("1");
    expect(tab(/Done today/)).toHaveTextContent("1");

    fireEvent.click(completeInHighlight());

    // Counts and the list change at once, while the request is in flight.
    expect(tab(/In consultation/)).toHaveTextContent("0");
    expect(tab(/Done today/)).toHaveTextContent("2");
    const glance = screen.getByRole("region", { name: "Today at a glance" });
    expect(
      within(glance).getByText("Seen today").previousElementSibling,
    ).toHaveTextContent("4");
    fireEvent.click(tab(/Done today/));
    const rows = within(screen.getByRole("tabpanel")).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("A-16");
    expect(rows[0]).toHaveTextContent("11:23–11:30");
    expect(rows[0]).toHaveTextContent("7 min");
    expect(rows[1]).toHaveTextContent("A-15");

    await act(async () => {
      resolveComplete(
        await respond(200, { token: completedView.completedToday[0] }),
      );
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Consultation with A-16 · Patient 16 completed.",
      ),
    );
    expect(tab(/Done today/)).toHaveTextContent("2");
  });

  it("moves the patient on the queue board too", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    render(<DoctorQueueBoard initialView={consulting} />);
    expect(tab(/Done today/)).toHaveTextContent("1");

    fireEvent.click(
      screen.getByRole("button", { name: /Complete consultation/ }),
    );

    expect(tab(/In consultation/)).toHaveTextContent("0");
    expect(tab(/Done today/)).toHaveTextContent("2");
    fireEvent.click(tab(/Done today/));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("A-16");
    expect(table).toHaveTextContent("11:23–11:30");
  });

  it("ignores a poll that started before the patient was completed", async () => {
    let resolveStalePoll!: (response: Response) => void;
    let polls = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return respond(200, { token: completedView.completedToday[0] });
      }
      polls += 1;
      // The first poll is slow and still has the patient in consultation.
      return polls === 1
        ? new Promise<Response>((r) => (resolveStalePoll = r))
        : respond(200, completedView);
    });
    render(<DoctorDashboard initialView={consulting} />);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    fireEvent.click(completeInHighlight());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await act(async () => {
      resolveStalePoll(await respond(200, consulting));
    });

    expect(tab(/Done today/)).toHaveTextContent("2");
    expect(tab(/In consultation/)).toHaveTextContent("0");
  });
});
