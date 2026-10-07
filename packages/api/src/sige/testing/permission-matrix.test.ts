import { SIGE_KINDS } from "@base-template/sige-core";
import { describe, expect, test } from "bun:test";

import { SIGE_TEST_ROLES } from "./fixture";
import { passedGate } from "./permission-matrix";

describe("passedGate", () => {
  test.each([null, "NOT_FOUND", "BAD_REQUEST", "CONFLICT"])(
    "%p counts as past the gate",
    (code) => {
      expect(passedGate(code)).toBe(true);
    },
  );

  test.each([
    "INTERNAL_SERVER_ERROR",
    "NOT_AN_ORPC_ERROR",
    "FORBIDDEN",
    "UNAUTHORIZED",
    "NO_PERSON",
    "PASSWORD_CHANGE_REQUIRED",
  ])("%p does not count as allowed", (code) => {
    expect(passedGate(code)).toBe(false);
  });
});

test("the test roles are the single SIGE kind list", () => {
  expect(SIGE_TEST_ROLES).toEqual(SIGE_KINDS);
});
