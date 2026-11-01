import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backoffDelay,
  HIDDEN_GRACE_MS,
  MessagingStream,
  parseMessagingEvent,
} from "@/components/messaging/stream";
import { FakeEventSource, setOnline } from "./fakes";

let visibility: DocumentVisibilityState = "visible";
const started: MessagingStream[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", FakeEventSource);
  FakeEventSource.reset();
  setOnline(true);
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  started.splice(0).forEach((stream) => stream.stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function startStream() {
  const stream = new MessagingStream("/api/messages/events");
  const onEvent = vi.fn();
  const onOpen = vi.fn();
  stream.subscribe({ onEvent, onOpen });
  stream.start();
  started.push(stream);
  return { stream, onEvent, onOpen };
}

describe("backoffDelay", () => {
  it("doubles each attempt, with jitter, up to 30 seconds", () => {
    expect(backoffDelay(0, () => 0)).toBe(500);
    expect(backoffDelay(0, () => 1)).toBe(1000);
    expect(backoffDelay(3, () => 0)).toBe(4000);
    expect(backoffDelay(20, () => 1)).toBe(30_000);
  });
});

describe("parseMessagingEvent", () => {
  it("accepts the contract's events and rejects anything else", () => {
    expect(
      parseMessagingEvent(
        JSON.stringify({
          type: "message",
          conversationId: "c",
          channel: "DOCTOR",
        }),
      ),
    ).toEqual({ type: "message", conversationId: "c", channel: "DOCTOR" });
    expect(
      parseMessagingEvent(
        JSON.stringify({ type: "broadcast", broadcastId: "b" }),
      ),
    ).toEqual({ type: "broadcast", broadcastId: "b" });
    expect(parseMessagingEvent("not json")).toBeNull();
    expect(parseMessagingEvent(JSON.stringify({ type: "typing" }))).toBeNull();
    expect(
      parseMessagingEvent(
        JSON.stringify({ type: "read", conversationId: "c", channel: "X" }),
      ),
    ).toBeNull();
  });
});

describe("MessagingStream", () => {
  it("goes live, passes events on and asks for a refetch on every open", () => {
    const { stream, onEvent, onOpen } = startStream();
    expect(stream.getSnapshot().status).toBe("connecting");

    FakeEventSource.latest().open();
    expect(stream.getSnapshot().status).toBe("live");
    expect(onOpen).toHaveBeenCalledTimes(1);

    FakeEventSource.latest().emit({
      type: "message",
      conversationId: "c1",
      channel: "RECEPTION",
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: "message",
      conversationId: "c1",
      channel: "RECEPTION",
    });
  });

  it("reconnects with backoff after an error, then refetches", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const { stream, onOpen } = startStream();
    const first = FakeEventSource.latest();
    first.open();

    first.fail();
    expect(first.closed).toBe(true);
    expect(stream.getSnapshot().status).toBe("reconnecting");
    expect(FakeEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.latest().fail();
    // The second wait is longer.
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(3);

    FakeEventSource.latest().open();
    expect(stream.getSnapshot().status).toBe("live");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("waits offline and reconnects at once when the browser is back", () => {
    const { stream } = startStream();
    FakeEventSource.latest().open();

    setOnline(false);
    window.dispatchEvent(new Event("offline"));
    expect(stream.getSnapshot().status).toBe("offline");
    expect(FakeEventSource.latest().closed).toBe(true);

    setOnline(true);
    window.dispatchEvent(new Event("online"));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.latest().closed).toBe(false);
  });

  it("lets go of a hidden tab's connection and reconnects when it's back", () => {
    const { stream } = startStream();
    FakeEventSource.latest().open();

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(HIDDEN_GRACE_MS);
    expect(FakeEventSource.latest().closed).toBe(true);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(stream.getSnapshot().status).toBe("reconnecting");
  });

  it("skips the backoff wait when the tab becomes visible", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    startStream();
    FakeEventSource.latest().fail();
    expect(FakeEventSource.instances).toHaveLength(1);

    document.dispatchEvent(new Event("visibilitychange"));

    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("closes everything on stop", () => {
    const { stream } = startStream();
    stream.stop();

    expect(FakeEventSource.latest().closed).toBe(true);
    window.dispatchEvent(new Event("online"));
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
