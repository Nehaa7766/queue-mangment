import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POLL_INTERVAL_MS,
  TokenStatusLive,
} from "@/components/patient/token-status-live";
import { errorResponse, jsonResponse, makeToken } from "./fixtures";

const fetchMock = vi.fn<typeof fetch>();
let hidden = false;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("TokenStatusLive", () => {
  it("polls for updates and shows the new state", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        token: makeToken({
          status: "CALLED",
          peopleAhead: null,
          estimate: null,
        }),
      }),
    );
    render(<TokenStatusLive initial={makeToken()} />);

    await advance(POLL_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/public/tokens/8d3f6f0e-2c1b-4f7a-9a51-0b6f1d2e3c4b",
    );
    expect(screen.getByText("It's your turn")).toBeInTheDocument();
  });

  it("pauses polling while the tab is hidden and refreshes on return", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: makeToken() }));
    render(<TokenStatusLive initial={makeToken()} />);

    hidden = true;
    await advance(POLL_INTERVAL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();

    hidden = false;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops polling once the visit is over", async () => {
    render(
      <TokenStatusLive
        initial={makeToken({
          status: "COMPLETED",
          peopleAhead: null,
          estimate: null,
        })}
      />,
    );

    await advance(POLL_INTERVAL_MS * 2);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the last data and says so when a refresh fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TokenStatusLive initial={makeToken()} />);

    await advance(POLL_INTERVAL_MS);

    expect(screen.getByText("3 people ahead of you")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't refresh/)).toBeInTheDocument();
  });

  it("shows not found when the token disappears", async () => {
    fetchMock.mockResolvedValue(errorResponse("TOKEN_NOT_FOUND", 404));
    render(<TokenStatusLive initial={makeToken()} />);

    await advance(POLL_INTERVAL_MS);

    expect(screen.getByText("We couldn't find this token")).toBeInTheDocument();
  });

  it("offers to leave the queue only while waiting", () => {
    const { unmount } = render(<TokenStatusLive initial={makeToken()} />);
    expect(
      screen.getByRole("button", { name: "Leave the queue" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <TokenStatusLive
        initial={makeToken({
          status: "CALLED",
          peopleAhead: null,
          estimate: null,
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Leave the queue" }),
    ).not.toBeInTheDocument();
  });

  it("updates to cancelled after confirming", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        token: makeToken({
          status: "CANCELLED",
          peopleAhead: null,
          estimate: null,
        }),
      }),
    );
    render(<TokenStatusLive initial={makeToken()} />);

    await act(async () => {
      screen.getByRole("button", { name: "Leave the queue" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "Leave queue" }).click();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/tokens/8d3f6f0e-2c1b-4f7a-9a51-0b6f1d2e3c4b/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByText("You've left the queue")).toBeInTheDocument();
  });
});
