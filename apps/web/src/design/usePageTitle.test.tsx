import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePageTitle } from "./usePageTitle";

function Probe({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

describe("usePageTitle", () => {
  beforeEach(() => {
    document.title = "Original";
  });

  it("sets the title and restores the previous one on unmount", () => {
    const { unmount } = render(<Probe title="Features" />);
    expect(document.title).toBe("Features");
    unmount();
    expect(document.title).toBe("Original");
  });
});
