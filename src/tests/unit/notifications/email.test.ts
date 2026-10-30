import { afterEach, describe, expect, it, vi } from "vitest";
import { selectEmailSenderKind } from "@/lib/email";
import {
  clearSentEmails,
  createMemorySender,
  getSentEmails,
  redactEmail,
} from "@/lib/email/memory-sender";
import {
  createResendSender,
  type ResendClient,
} from "@/lib/email/resend-sender";

const MESSAGE = {
  to: "priya@clinic.test",
  subject: "Reset your QueueCare password",
  html: "<p>https://app.test/reset-password?token=secret</p>",
  text: "https://app.test/reset-password?token=secret",
  idempotencyKey: "outbox-1",
};

describe("selectEmailSenderKind", () => {
  it("uses Resend whenever a key is set", () => {
    expect(
      selectEmailSenderKind({ NODE_ENV: "production", RESEND_API_KEY: "re_1" }),
    ).toBe("resend");
    expect(
      selectEmailSenderKind({
        NODE_ENV: "development",
        RESEND_API_KEY: "re_1",
      }),
    ).toBe("resend");
  });

  it("captures mail in development and tests", () => {
    expect(selectEmailSenderKind({ NODE_ENV: "development" })).toBe("memory");
    expect(selectEmailSenderKind({ NODE_ENV: "test" })).toBe("memory");
  });

  it("refuses to pretend in production without a key", () => {
    expect(selectEmailSenderKind({ NODE_ENV: "production" })).toBe(
      "unconfigured",
    );
  });
});

describe("memory sender", () => {
  afterEach(() => {
    clearSentEmails();
  });

  it("keeps the message and logs one redacted line without the link", async () => {
    const log = vi.fn();

    await createMemorySender(log).send(MESSAGE);

    expect(getSentEmails()).toEqual([MESSAGE]);
    expect(log).toHaveBeenCalledOnce();
    const line = log.mock.calls[0][0] as string;
    expect(line).toContain("p***@clinic.test");
    expect(line).not.toContain("priya");
    expect(line).not.toContain("token");
  });

  it("redacts addresses", () => {
    expect(redactEmail("priya@clinic.test")).toBe("p***@clinic.test");
    expect(redactEmail("not-an-address")).toBe("***");
  });
});

describe("Resend sender", () => {
  function stubClient(result: unknown) {
    const send = vi.fn().mockResolvedValue(result);
    return { client: { emails: { send } } as unknown as ResendClient, send };
  }

  it("sends from the configured address with the idempotency key", async () => {
    const { client, send } = stubClient({ data: { id: "em_1" }, error: null });
    const sender = createResendSender({
      apiKey: "re_test",
      from: "QueueCare <notifications@example.test>",
      client,
    });

    await expect(sender.send(MESSAGE)).resolves.toEqual({ id: "em_1" });
    expect(send).toHaveBeenCalledWith(
      {
        from: "QueueCare <notifications@example.test>",
        to: MESSAGE.to,
        subject: MESSAGE.subject,
        html: MESSAGE.html,
        text: MESSAGE.text,
      },
      { idempotencyKey: "outbox-1" },
    );
  });

  it("throws when Resend returns an error", async () => {
    const { client } = stubClient({
      data: null,
      error: {
        name: "validation_error",
        message: "bad",
        statusCode: 422,
      },
    });
    const sender = createResendSender({
      apiKey: "re_test",
      from: "notifications@example.test",
      client,
    });

    await expect(sender.send(MESSAGE)).rejects.toThrow("validation_error");
  });
});
