import { describe, expect, it } from "vitest";
import {
  findPromptEmphasisHighlightRanges,
  findPromptEmphasisSyntaxIssues,
} from "@/lib/prompt-emphasis-syntax";
import { parsePromptTokens } from "@/lib/token";

describe("prompt emphasis syntax", () => {
  it("anchors malformed explicit-weight recovery issues to the opening token", () => {
    const issues = findPromptEmphasisSyntaxIssues(
      "0.75::artist:oda_eiichirou, year 2023, year 2024, 1.2::oekaki ::,",
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("invalidExplicitWeight");
    expect(issues[0]?.anchorText).toBe("artist:oda_eiichirou");
    expect(issues[0]?.raw).toBe(
      "0.75::artist:oda_eiichirou, year 2023, year 2024, 1.2::oekaki ::",
    );
  });

  it("does not flag valid explicit-weight groups that contain multiple tags", () => {
    const issues = findPromptEmphasisSyntaxIssues(
      "0.75::artist:oda_eiichirou, year 2023::, 1.2::oekaki::",
    );

    expect(issues).toHaveLength(0);
  });

  it("keeps bracket emphasis with multiple tags as a single token", () => {
    const tokens = parsePromptTokens("{artist:oda_eiichirou, year 2023}, test");

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({
      text: "artist:oda_eiichirou, year 2023",
    });
    expect(tokens[1]).toMatchObject({
      text: "test",
    });
  });

  it("returns exact raw highlight ranges for multi-tag explicit segments", () => {
    const prompt = "0.75::artist:oda_eiichirou, year 2023::, 1.2::oekaki::";
    const ranges = findPromptEmphasisHighlightRanges(prompt);

    expect(ranges).toEqual([
      {
        start: 0,
        end: "0.75::artist:oda_eiichirou, year 2023::".length,
        weight: 0.75,
      },
      {
        start: "0.75::artist:oda_eiichirou, year 2023::, ".length,
        end: prompt.length,
        weight: 1.2,
      },
    ]);
    expect(ranges.map((range) => prompt.slice(range.start, range.end))).toEqual([
      "0.75::artist:oda_eiichirou, year 2023::",
      "1.2::oekaki::",
    ]);
  });

  it("returns exact raw highlight ranges for multi-tag bracket emphasis", () => {
    const prompt = "{artist:oda_eiichirou, year 2023}, [simple background], plain";
    const ranges = findPromptEmphasisHighlightRanges(prompt);

    expect(ranges.map((range) => prompt.slice(range.start, range.end))).toEqual([
      "{artist:oda_eiichirou, year 2023}",
      "[simple background]",
    ]);
  });
});
