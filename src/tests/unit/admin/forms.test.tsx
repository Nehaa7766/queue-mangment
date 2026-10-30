import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { validateAcceptForm } from "@/components/admin/accept-invite-form";
import { validateInvitation } from "@/components/admin/invite-form";
import { OpeningHoursEditor } from "@/components/admin/opening-hours-editor";
import { validateServiceForm } from "@/components/admin/services-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("form validation", () => {
  it("checks the service form with the API's schema", () => {
    const { data, errors } = validateServiceForm({
      name: "X",
      description: "",
      tokenPrefix: "toolong",
      estimatedDurationMinutes: "abc",
    });

    expect(data).toBeNull();
    expect(errors.name).toBeTruthy();
    expect(errors.tokenPrefix).toMatch(/1–3 letters/);
    expect(errors.estimatedDurationMinutes).toMatch(/1 and 240/);
  });

  it("accepts a valid service and upper-cases its prefix", () => {
    const { data } = validateServiceForm({
      name: "Physio",
      description: "",
      tokenPrefix: "p",
      estimatedDurationMinutes: "20",
    });

    expect(data).toMatchObject({
      tokenPrefix: "P",
      estimatedDurationMinutes: 20,
    });
  });

  it("checks the invitation email", () => {
    expect(
      validateInvitation({ name: "Asha", email: "nope", role: "DOCTOR" }).errors
        .email,
    ).toMatch(/valid email/);
  });

  it("asks new accounts for a matching password", () => {
    expect(
      validateAcceptForm(
        { name: "Asha", password: "long-enough", confirm: "different" },
        true,
      ),
    ).toEqual({ confirm: "The passwords don't match." });
    expect(
      validateAcceptForm({ name: "Asha", password: "", confirm: "" }, false),
    ).toEqual({});
  });
});

describe("OpeningHoursEditor", () => {
  it("saves the hours in the stored format", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <OpeningHoursEditor
        clinicId="clinic"
        initial={{ mon: [["09:00", "13:00"]] }}
        onSave={onSave}
      />,
    );

    // Open Tuesday with the default hours.
    fireEvent.click(screen.getByRole("checkbox", { name: /Tuesday/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save opening hours" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      mon: [["09:00", "13:00"]],
      tue: [["09:00", "17:00"]],
    });
  });

  it("shows the problem next to the day and doesn't save", () => {
    const onSave = vi.fn();
    render(
      <OpeningHoursEditor
        clinicId="clinic"
        initial={{ wed: [["09:00", "13:00"]] }}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Wednesday closing 1"), {
      target: { value: "08:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save opening hours" }));

    expect(screen.getByText("Closing must be after opening.")).toBeVisible();
    expect(screen.getByLabelText("Wednesday closing 1")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves null when hours are switched off", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <OpeningHoursEditor
        clinicId="clinic"
        initial={{ mon: [["09:00", "13:00"]] }}
        onSave={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: /Set opening hours/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save opening hours" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
});
