import { describe, expect, test } from "bun:test";

import { resolveNavPermissions } from "@/app/navigation";

import { allowedActions, SCHEDULING_ACTIONS, type SchedulingScreen } from "./action-permissions";

/** The real built-in role grants, resolved the way the web resolves them for the sidebar. */
const role = (roleName: string) => resolveNavPermissions({ roleName }, undefined);

const SCREENS = Object.keys(SCHEDULING_ACTIONS) as SchedulingScreen[];

/** Every action of every screen, as `screen.action` keys of the allowed ones. */
function allowedKeys(permissions: ReturnType<typeof role>): string[] {
  return SCREENS.flatMap((screen) =>
    Object.entries(allowedActions(screen, permissions))
      .filter(([, allowed]) => allowed)
      .map(([action]) => `${screen}.${action}`),
  );
}

const ALL_KEYS = SCREENS.flatMap((screen) =>
  Object.keys(SCHEDULING_ACTIONS[screen]).map((action) => `${screen}.${action}`),
);

describe("SCHEDULING_ACTIONS", () => {
  test("names the permission of the procedure or route behind each action (sige/04 §3)", () => {
    expect(SCHEDULING_ACTIONS.offerings).toEqual({
      viewAssignments: "offering:read",
      assign: "offering:create",
      editHours: "offering:update",
      delete: "offering:delete",
    });
    // `assignment.assign/update/delete` all need `offering:update`.
    expect(SCHEDULING_ACTIONS.assignments).toEqual({
      viewOfferings: "offering:read",
      create: "offering:update",
      edit: "offering:update",
      delete: "offering:update",
    });
    expect(SCHEDULING_ACTIONS.classrooms).toEqual({
      create: "classroom:create",
      edit: "classroom:update",
      delete: "classroom:delete",
    });
    expect(SCHEDULING_ACTIONS.timeBlocks).toEqual({
      create: "time_block:create",
      edit: "time_block:update",
      delete: "time_block:delete",
    });
    expect(SCHEDULING_ACTIONS.schedules).toEqual({
      view: "schedule:read",
      generate: "schedule:generate",
      removeSlot: "schedule:update",
    });
  });
});

describe("allowedActions per built-in role (sige/00 §4.2, SCH-R1)", () => {
  test.each(["owner", "admin", "coordinator"])("a %s sees every P3 action", (roleName) => {
    expect(allowedKeys(role(roleName))).toEqual(ALL_KEYS);
  });

  test.each(["teacher", "student"])(
    "a %s only reads schedules: no management action",
    (roleName) => {
      expect(allowedKeys(role(roleName))).toEqual(["schedules.view"]);
    },
  );

  test.each(["parent", "viewer"])("a %s sees no P3 action", (roleName) => {
    expect(allowedKeys(role(roleName))).toEqual([]);
  });

  test("unresolved permissions allow nothing (fail closed)", () => {
    expect(allowedKeys(null)).toEqual([]);
  });
});

describe("allowedActions per action (custom roles)", () => {
  test("creating a classroom does not show edit or delete", () => {
    expect(allowedActions("classrooms", { classroom: ["read", "create"] })).toEqual({
      create: true,
      edit: false,
      delete: false,
    });
  });

  test("time block edit and delete follow their own permissions", () => {
    expect(allowedActions("timeBlocks", { time_block: ["read", "delete"] })).toEqual({
      create: false,
      edit: false,
      delete: true,
    });
  });

  test("offering mutations are independent and the cross link needs offering:read", () => {
    expect(allowedActions("offerings", { offering: ["update"] })).toEqual({
      viewAssignments: false,
      assign: false,
      editHours: true,
      delete: false,
    });
  });

  test("assignment create, edit and delete all follow offering:update", () => {
    expect(allowedActions("assignments", { offering: ["read", "create", "delete"] })).toEqual({
      viewOfferings: true,
      create: false,
      edit: false,
      delete: false,
    });
  });

  test("generating without schedule:read hides Ver Horario but keeps Generar", () => {
    expect(allowedActions("schedules", { schedule: ["generate"] })).toEqual({
      view: false,
      generate: true,
      removeSlot: false,
    });
  });
});
