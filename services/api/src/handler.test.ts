import { describe, expect, it } from "vitest";

import { handler } from "./handler";

describe("handler", () => {
  it("responds with hello", async () => {
    await expect(handler()).resolves.toEqual({ message: "hello", app: "TrackThat" });
  });
});
