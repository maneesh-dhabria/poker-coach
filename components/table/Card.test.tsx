import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "@/components/table/Card";

describe("Card — winning-card highlight (T8)", () => {
  it("applies the card-hi class when highlighted", () => {
    const { container } = render(<Card card={"Ah" as any} highlighted />);
    expect(container.querySelector(".card-hi")).toBeTruthy();
  });

  it("does not apply card-hi by default", () => {
    const { container } = render(<Card card={"Ah" as any} />);
    expect(container.querySelector(".card-hi")).toBeFalsy();
  });
});
