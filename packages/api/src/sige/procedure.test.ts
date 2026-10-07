import { describe, expect, test } from "bun:test";

import { resolveCallerKind } from "./procedure";

describe("resolveCallerKind", () => {
  test.each(["owner", "admin", "coordinator", "teacher", "student", "parent", "viewer"])(
    "built-in role %s maps to itself",
    (role) => {
      expect(resolveCallerKind(role)).toBe(role as never);
    },
  );

  test.each(["secretaria", "member", "", "teacher,admin", "Teacher"])(
    "anything else (%p) is a custom role",
    (role) => {
      expect(resolveCallerKind(role)).toBe("custom");
    },
  );
});
