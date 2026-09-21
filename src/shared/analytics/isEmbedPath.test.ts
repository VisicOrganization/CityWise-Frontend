import { describe, expect, it } from "vitest";

import { isEmbedPath } from "./isEmbedPath";

describe("isEmbedPath", () => {
  it.each(["/embed/v1/cd2/valley-glen", "/embed/v1/cd2", "/embed/v1/builder", "/embed/v1/cd2/"])(
    "suppresses analytics on %s",
    (pathname) => {
      expect(isEmbedPath(pathname, "/")).toBe(true);
    },
  );

  it.each(["/", "/map", "/about", "/districts/2", "/homeless-count"])(
    "leaves analytics enabled on %s",
    (pathname) => {
      expect(isEmbedPath(pathname, "/")).toBe(false);
    },
  );

  it("does not match a path that merely starts with the word embed", () => {
    expect(isEmbedPath("/embedded-thing", "/")).toBe(false);
    expect(isEmbedPath("/embeds", "/")).toBe(false);
  });

  it("treats a bare /embed as an embed route rather than a false negative", () => {
    expect(isEmbedPath("/embed", "/")).toBe(true);
  });

  it("still matches under a subpath deploy, with or without a trailing slash on BASE_URL", () => {
    expect(isEmbedPath("/app/embed/v1/cd2", "/app/")).toBe(true);
    expect(isEmbedPath("/app/embed/v1/cd2", "/app")).toBe(true);
    expect(isEmbedPath("/app/map", "/app/")).toBe(false);
  });
});
