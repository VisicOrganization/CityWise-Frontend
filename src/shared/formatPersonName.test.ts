import { describe, expect, it } from "vitest";

import { formatPersonNameForDisplay } from "./formatPersonName";

describe("formatPersonNameForDisplay", () => {
  it("title-cases each word", () => {
    expect(formatPersonNameForDisplay("john smith")).toBe("John Smith");
    expect(formatPersonNameForDisplay("JOHN SMITH")).toBe("John Smith");
    expect(formatPersonNameForDisplay("  jane   doe  ")).toBe("Jane Doe");
  });

  it("title-cases hyphenated segments", () => {
    expect(formatPersonNameForDisplay("MARY-JANE WATSON")).toBe("Mary-Jane Watson");
  });

  it("leaves non-letter-leading tokens as-is", () => {
    expect(formatPersonNameForDisplay("District 12")).toBe("District 12");
  });
});
