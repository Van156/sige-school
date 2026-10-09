import { describe, expect, test } from "bun:test";

import { hasOrpcErrorCode, isNotFoundError } from "./orpc-error";

describe("isNotFoundError", () => {
  test("recognises the NOT_FOUND code only", () => {
    expect(isNotFoundError({ code: "NOT_FOUND" })).toBe(true);
    expect(isNotFoundError({ code: "INTERNAL_SERVER_ERROR" })).toBe(false);
    expect(isNotFoundError(new Error("x"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError("NOT_FOUND")).toBe(false);
  });
});

describe("hasOrpcErrorCode", () => {
  test("matches the given code", () => {
    expect(hasOrpcErrorCode({ code: "CONFLICT" }, "CONFLICT")).toBe(true);
    expect(hasOrpcErrorCode({ code: "CONFLICT" }, "NOT_FOUND")).toBe(false);
  });
});
