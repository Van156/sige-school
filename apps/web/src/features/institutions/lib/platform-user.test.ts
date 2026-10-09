import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PLATFORM_ROLE,
  PLATFORM_ROLE_OPTIONS,
  PLATFORM_USER_FIELD_BY_MESSAGE,
  emptyPlatformUserForm,
  platformCreatedNotice,
  platformRoleOptionText,
  platformUserFormSchema,
  toPlatformResetInput,
  toPlatformUserCreateInput,
} from "./platform-user";

const filled = {
  ...emptyPlatformUserForm(),
  firstName: "Ana",
  lastName: "Gómez",
  documentNumber: "1101234501",
  email: "ana@colegio.edu.co",
};

describe("INS-05 role select", () => {
  test("offers the six roles of the spec in order, Profesor by default", () => {
    expect(PLATFORM_ROLE_OPTIONS.map((option) => platformRoleOptionText(option))).toEqual([
      "🔵 Administrador - Gestiona toda la institución",
      "🟣 Coordinador - Supervisión académica",
      "🟡 Profesor - Notas, asistencia, observaciones",
      "🟢 Estudiante - Consulta sus datos",
      "🔵 Acudiente - Portal de padres",
      "⚪ Consulta - Solo lectura",
    ]);
    expect(emptyPlatformUserForm().role).toBe(DEFAULT_PLATFORM_ROLE);
    expect(DEFAULT_PLATFORM_ROLE).toBe("teacher");
  });

  test("Administrador creates an admin member", () => {
    expect(PLATFORM_ROLE_OPTIONS[0]?.value).toBe("admin");
    expect(toPlatformUserCreateInput("inst-1", { ...filled, role: "admin" }).role).toBe("admin");
  });
});

describe("platformUserFormSchema", () => {
  test("a filled form parses", () => {
    expect(platformUserFormSchema.safeParse(filled).success).toBe(true);
  });

  test("email is mandatory here and gets the API message", () => {
    const result = platformUserFormSchema.safeParse({ ...filled, email: "  " });
    expect(result.error?.issues[0]?.message).toBe("Ingresa un correo válido.");
    expect(platformUserFormSchema.safeParse({ ...filled, email: "no-es-correo" }).success).toBe(
      false,
    );
  });

  test("the API messages guard names and document", () => {
    const result = platformUserFormSchema.safeParse({
      ...filled,
      firstName: "",
      documentNumber: "12",
    });
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toContain("Los nombres son obligatorios.");
    expect(messages).toContain("El documento debe tener al menos 5 caracteres.");
  });
});

describe("toPlatformUserCreateInput", () => {
  test("carries the institution and omits a blank phone", () => {
    const input = toPlatformUserCreateInput("inst-1", filled);
    expect(input).toMatchObject({
      institutionId: "inst-1",
      firstName: "Ana",
      documentType: "CC",
      email: "ana@colegio.edu.co",
      role: "teacher",
    });
    expect(input.phone).toBeUndefined();
  });
});

describe("platformCreatedNotice", () => {
  test("a staff user gets the regular notice", () => {
    expect(platformCreatedNotice({ username: "agomez4501", next: null })).toEqual({
      title: "Usuario creado",
      description: "agomez4501 · contraseña inicial: Nº de documento.",
    });
  });

  test("a student's notice asks the coordinator to complete the academic profile", () => {
    expect(
      platformCreatedNotice({ username: "agomez4501", next: { screen: "STU-03", personId: "p1" } }),
    ).toEqual({
      title: "Usuario creado",
      description: "agomez4501 · pida al coordinador completar el perfil académico.",
    });
  });
});

describe("server conflicts", () => {
  test("a second owner is shown under the role", () => {
    expect(PLATFORM_USER_FIELD_BY_MESSAGE["La institución ya tiene un propietario."]).toBe("role");
    expect(PLATFORM_USER_FIELD_BY_MESSAGE["Ya existe un usuario con este documento."]).toBe(
      "documentNumber",
    );
  });
});

describe("toPlatformResetInput", () => {
  test("maps a custom password to the platform input", () => {
    expect(
      toPlatformResetInput("inst-1", "p1", { mode: "custom", newPassword: "nueva-clave-1" }),
    ).toEqual({ institutionId: "inst-1", personId: "p1", newPassword: "nueva-clave-1" });
  });

  test("refuses the document mode, which only institutions use", () => {
    expect(() => toPlatformResetInput("inst-1", "p1", { mode: "document" })).toThrow();
  });
});
