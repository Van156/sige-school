import { describe, expect, test } from "bun:test";

import { resolveCallerKind } from "./procedure";

describe("resolveCallerKind", () => {
  test.each(["owner", "admin", "coordinator", "teacher", "student", "parent", "viewer"])(
    "built-in role %s maps to itself",
    (role) => {
      expect(resolveCallerKind(role)).toBe(role as never);
    },
  );

  test.each(["secretaria", "member", "", "Teacher"])(
    "anything else (%p) is a custom role",
    (role) => {
      expect(resolveCallerKind(role)).toBe("custom");
    },
  );

  // better-auth stores several roles comma-separated; a restricted kind must never be unrestricted.
  test.each([
    ["teacher,admin", "teacher"],
    ["admin,teacher", "teacher"],
    ["secretaria,teacher", "teacher"],
    ["owner, student ", "student"],
    ["teacher,parent", "parent"],
    ["parent,student", "student"],
    ["teacher,student,parent", "student"],
  ])("multi-role %p resolves to the most restrictive kind %p", (role, expected) => {
    expect(resolveCallerKind(role)).toBe(expected as never);
  });

  test.each([
    ["admin,secretaria", "admin"],
    ["secretaria,viewer", "viewer"],
    ["secretaria,tesoreria", "custom"],
  ])("multi-role %p with no restricted kind resolves to %p", (role, expected) => {
    expect(resolveCallerKind(role)).toBe(expected as never);
  });
});
