import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Landing } from "./Landing";

describe("Landing", () => {
  it("shows the site name as the only heading", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1, name: "Track That" })).toBeTruthy();
  });
});
