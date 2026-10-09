import { describe, expect, test } from "bun:test";

import { platformPreviewInput } from "./platform-username-preview";

const parts = { firstName: "Ana", lastName: "Pérez", documentNumber: "12345" };

describe("platformPreviewInput", () => {
  test("INS-02 sends the bare names, with no institution", () => {
    const input = platformPreviewInput(parts);
    expect(input).toEqual(parts);
    expect("institutionId" in input).toBe(false);
  });

  test("INS-05 merges the institution into the names", () => {
    expect(platformPreviewInput(parts, "inst-1")).toEqual({ ...parts, institutionId: "inst-1" });
  });
});
