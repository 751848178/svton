import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("favicon response", () => {
  it("avoids a browser-visible missing-resource error", () => {
    const response = GET();

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=86400",
    );
  });
});
