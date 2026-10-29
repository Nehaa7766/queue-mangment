import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "@/app/page";

it("shows the now serving ticket with its actions", () => {
  render(<Home />);

  const ticket = screen.getByRole("region", { name: "Now serving" });
  expect(within(ticket).getByText("A-17")).toBeInTheDocument();
  expect(
    within(ticket).getByRole("button", { name: "Call next" }),
  ).toBeInTheDocument();
});
