import { describe, expect, test } from "bun:test";

import { createdUserNotice } from "./user-create-flow";

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
