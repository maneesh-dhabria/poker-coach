import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionBadge } from "@/components/SessionBadge";

beforeEach(() => cleanup());

describe("SessionBadge", () => {
  it("shows the session id and a copy control (observation #5)", () => {
    render(<SessionBadge sessionId="20260529-124600-ab12" />);
    expect(screen.getByTestId("session-id").textContent).toBe("20260529-124600-ab12");
    expect(screen.getByRole("button", { name: /copy session id/i })).toBeInTheDocument();
  });

  it("renders nothing before a session has started", () => {
    const { container } = render(<SessionBadge sessionId={null} />);
    expect(container.firstChild).toBeNull();
  });
});
