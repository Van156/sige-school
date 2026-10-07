import { describe, expect, test } from "bun:test";

import { isPasswordChangeRequiredError } from "./password-gate";

describe("isPasswordChangeRequiredError", () => {
  test("matches the oRPC gate error by code", () => {
    expect(isPasswordChangeRequiredError({ code: "PASSWORD_CHANGE_REQUIRED", status: 403 })).toBe(
      true,
    );
  });

  test("ignores other errors", () => {
    expect(isPasswordChangeRequiredError({ code: "FORBIDDEN" })).toBe(false);
    expect(isPasswordChangeRequiredError(new Error("x"))).toBe(false);
    expect(isPasswordChangeRequiredError(null)).toBe(false);
  });
});
