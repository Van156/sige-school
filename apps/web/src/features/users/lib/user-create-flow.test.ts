import { describe, expect, test } from "bun:test";

import { createdUserDestination, createdUserNotice } from "./user-create-flow";

describe("createdUserNotice", () => {
  test("names the generated username and the initial password", () => {
    expect(createdUserNotice({ username: "jperez1234", next: null })).toEqual({
      title: "Usuario creado",
      description: "jperez1234 · contraseña inicial: Nº de documento.",
    });
  });

  test("a student points at the academic profile still to complete", () => {
    expect(
      createdUserNotice({ username: "jperez1234", next: { screen: "STU-03", personId: "p1" } }),
    ).toEqual({
      title: "Usuario creado",
      description: "jperez1234 · completa su perfil académico.",
    });
  });
});

describe("createdUserDestination", () => {
  const student = { next: { screen: "STU-03", personId: "p1" } };

  test("a student goes on to complete the academic profile (F4 path B)", () => {
    expect(createdUserDestination(student, true)).toEqual({
      screen: "complete-student-profile",
      personId: "p1",
    });
  });

  test("any other role returns to the user list", () => {
    expect(createdUserDestination({ next: null }, true)).toEqual({ screen: "users" });
  });

  test("a caller who cannot complete profiles returns to the user list", () => {
    expect(createdUserDestination(student, false)).toEqual({ screen: "users" });
  });
});
