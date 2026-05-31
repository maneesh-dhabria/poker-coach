import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RankingsTab } from "@/components/RankingsTab";
import { HandCategory } from "@/core/eval/handEval";

describe("RankingsTab", () => {
  it("lists every HandCategory as a row, strongest first", () => {
    const { getAllByTestId } = render(<RankingsTab />);
    const rows = getAllByTestId("ranking-row");
    // Derived from the enum — no hand-maintained duplicate list (G6).
    const enumCount = Object.values(HandCategory).filter((v) => typeof v === "number").length;
    expect(rows).toHaveLength(enumCount);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent(/straight flush/i);
    expect(rows[8]).toHaveTextContent(/high card/i);
  });

  it("gives each row a non-empty plain-language example", () => {
    const { getAllByTestId } = render(<RankingsTab />);
    const examples = getAllByTestId("ranking-example");
    expect(examples).toHaveLength(9);
    for (const ex of examples) {
      expect(ex.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
