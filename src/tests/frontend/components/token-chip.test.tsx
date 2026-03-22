import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenChip } from "@/components/token-chip";

vi.mock("@/components/prompt-tag-suggestion-indicator", () => ({
  PromptTagSuggestionIndicator: () => <span data-testid="tag-indicator" />,
}));

describe("TokenChip", () => {
  it("can show a syntax warning from an external prompt-level override", () => {
    const { container } = render(
      <TokenChip
        token={{ text: "artist:oda_eiichirou", weight: 0.75, raw: "0.75::artist:oda_eiichirou::" }}
        raw="0.75::artist:oda_eiichirou::"
        syntaxIssueKind="invalidExplicitWeight"
      />,
    );

    const chip = screen.getByRole("button", {
      name: /artist:oda_eiichirou.*x0\.75/i,
    });
    const warning = container.querySelector("[data-token-syntax-warning]");

    expect(chip).toHaveAttribute("title", "Invalid explicit emphasis syntax");
    expect(chip).toHaveClass("bg-destructive/16");
    expect(warning).toBeInTheDocument();
  });

  it("shows a warning affordance for malformed explicit emphasis syntax", () => {
    const { container } = render(
      <TokenChip
        token={{ text: "1.2::oda_eiichirou", weight: 1, raw: "1.2::oda_eiichirou" }}
        raw="1.2::oda_eiichirou"
      />,
    );

    const chip = screen.getByRole("button", { name: "1.2::oda_eiichirou" });
    const warning = container.querySelector("[data-token-syntax-warning]");

    expect(chip).toHaveAttribute("title", "Invalid explicit emphasis syntax");
    expect(chip).toHaveClass("bg-destructive/16");
    expect(warning).toBeInTheDocument();
  });

  it("shows a warning affordance for malformed bracket emphasis syntax", () => {
    const { container } = render(
      <TokenChip
        token={{ text: "{oda_eiichirou", weight: 1, raw: "{oda_eiichirou" }}
        raw="{oda_eiichirou"
      />,
    );

    const chip = screen.getByRole("button", { name: "{oda_eiichirou" });
    const warning = container.querySelector("[data-token-syntax-warning]");

    expect(chip).toHaveAttribute("title", "Invalid bracket emphasis syntax");
    expect(chip).toHaveClass("bg-destructive/16");
    expect(warning).toBeInTheDocument();
  });
});
