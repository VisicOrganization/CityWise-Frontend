import { describe, expect, it } from "vitest";

import { resolvePostLoginReturnTo } from "./AuthProvider";

describe("resolvePostLoginReturnTo", () => {
  it("keeps subscription routes", () => {
    expect(resolvePostLoginReturnTo("/new-files")).toBe("/new-files");
    expect(resolvePostLoginReturnTo("/subscriptions/settings")).toBe("/subscriptions/settings");
    expect(resolvePostLoginReturnTo("/new-files?page=2")).toBe("/new-files?page=2");
  });

  it("defaults non-subscription routes to the dashboard", () => {
    expect(resolvePostLoginReturnTo("/")).toBe("/new-files");
    expect(resolvePostLoginReturnTo("/map")).toBe("/new-files");
    expect(resolvePostLoginReturnTo("/?error=invalid_request")).toBe("/new-files");
  });
});
