import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CoachingViewer } from "@/components/CoachingViewer";

beforeEach(() => cleanup());

function mockCoaching(files: { name: string; content: string }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, files }) })),
  );
}

describe("CoachingViewer", () => {
  it("renders coaching markdown headings and leak bullets", async () => {
    mockCoaching([
      {
        name: "s_h1.md",
        content: "# Hand 1\n## Recurring leaks\n- Calling too wide\n- Missing thin value\n",
      },
    ]);
    render(<CoachingViewer sessionId="s" />);
    expect(await screen.findByRole("heading", { name: /recurring leaks/i })).toBeInTheDocument();
    expect(screen.getByText(/Calling too wide/i)).toBeInTheDocument();
  });

  it("shows the how-to empty state when there is no coaching", async () => {
    mockCoaching([]);
    render(<CoachingViewer sessionId="s" />);
    expect(await screen.findByTestId("coaching-empty")).toBeInTheDocument();
    expect(screen.getAllByText(/poker-coach/i).length).toBeGreaterThan(0);
  });

  it("has a refresh control", async () => {
    mockCoaching([]);
    render(<CoachingViewer sessionId="s" />);
    await screen.findByTestId("coaching-empty");
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });
});
