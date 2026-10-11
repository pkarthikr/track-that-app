import { describe, expect, it } from "vitest";

import { describeCore } from "./index";

describe("core", () => {
  it("returns a placeholder description", () => {
    expect(describeCore()).toBe("TrackThat core is wired up");
  });
});
