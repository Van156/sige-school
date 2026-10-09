import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { DOCUMENT_TYPES as DB_DOCUMENT_TYPES } from "@base-template/auth/provision-user";
import { DOCUMENT_TYPES, todayIn } from "@base-template/sige-core";
import type { ZodType } from "zod";

import {
  userCheckEmailInput,
  userCreateInput,
  userEditInput,
  userOptionsInput,
  userPersonInput,
  userPreviewUsernameInput,
  userResetPasswordInput,
  userSetActiveInput,
  userUpdateInput,
} from "./user";

function issues(schema: ZodType, value: unknown): Record<string, string[]> {
  const result = schema.safeParse(value);
  if (result.success) {
    return {};
  }
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (byField[issue.path.join(".")] ??= []).push(issue.message);
  }
  return byField;
}

const create = {
  firstName: "María",
  lastName: "Londoño",
  documentType: "CC",
  documentNumber: "1101234501",
  role: "teacher",
};

const nextYear = `${new Date().getUTCFullYear() + 1}-01-01`;
const today = todayIn();

describe("document types", () => {
  test("stay in sync with the DB enum", () => {
    expect([...DOCUMENT_TYPES]).toEqual([...DB_DOCUMENT_TYPES]);
  });
});

describe("userCreateInput (sige/03 §3.3, §4.1)", () => {
  test("minimal input parses; documentType defaults to CC", () => {
    const { documentType: _omit, ...rest } = create;
    const parsed = userCreateInput.parse(rest);
    expect(parsed.documentType).toBe("CC");
    expect(parsed.email).toBeUndefined();
  });

  test("full input parses with trimming and lowercase email", () => {
    const parsed = userCreateInput.parse({
      ...create,
      firstName: "  María ",
      email: " Maria@Colegio.EDU.co ",
      birthDate: "2000-02-29",
      gender: "F",
      phone: " 3001234567 ",
      address: "Calle 1",
      country: "Colombia",
      department: "Antioquia",
      municipality: "Medellín",
    });
    expect(parsed).toMatchObject({
      firstName: "María",
      email: "maria@colegio.edu.co",
      birthDate: "2000-02-29",
      gender: "F",
      phone: "3001234567",
    });
  });

  test.each(["firstName", "lastName"] as const)("%s required and trimmed", (field) => {
    const message =
      field === "firstName" ? "Los nombres son obligatorios." : "Los apellidos son obligatorios.";
    expect(issues(userCreateInput, { ...create, [field]: "   " })[field]).toEqual([message]);
    expect(issues(userCreateInput, { ...create, [field]: undefined })[field]).toEqual([message]);
  });

  test("names accept 100 characters and reject 101", () => {
    expect(issues(userCreateInput, { ...create, firstName: "a".repeat(100) })).toEqual({});
    expect(issues(userCreateInput, { ...create, firstName: "a".repeat(101) }).firstName).toEqual([
      "No puede superar 100 caracteres.",
    ]);
  });

  test.each(["TI", "CC", "RC", "CE", "Pasaporte"])("documentType %s accepted", (documentType) => {
    expect(issues(userCreateInput, { ...create, documentType })).toEqual({});
  });

  test("documentType rejects unknown values", () => {
    expect(issues(userCreateInput, { ...create, documentType: "DNI" }).documentType).toEqual([
      "Tipo de documento inválido.",
    ]);
  });

  test.each([
    ["1234", ["El documento debe tener al menos 5 caracteres."]],
    ["", ["El documento debe tener al menos 5 caracteres."]],
    ["12345", undefined],
    ["AB123", undefined],
    ["1".repeat(20), undefined],
    ["1".repeat(21), ["El documento no puede superar 20 caracteres."]],
    ["12345-67", ["El documento solo admite letras y números."]],
    ["12 345", ["El documento solo admite letras y números."]],
  ])("documentNumber %p", (documentNumber, expected) => {
    expect(issues(userCreateInput, { ...create, documentNumber }).documentNumber).toEqual(expected);
  });

  test("email: blank is absent, invalid reports the verbatim message", () => {
    expect(userCreateInput.parse({ ...create, email: "   " }).email).toBeUndefined();
    expect(userCreateInput.parse({ ...create, email: "" }).email).toBeUndefined();
    expect(issues(userCreateInput, { ...create, email: "no-es-correo" }).email).toEqual([
      "Ingresa un correo válido.",
    ]);
  });

  describe("birthDate against the Bogota calendar day", () => {
    afterEach(() => setSystemTime());

    test("03:00 UTC on the 9th is still the 8th in Bogota", () => {
      setSystemTime(new Date("2026-10-09T03:00:00Z"));
      expect(issues(userCreateInput, { ...create, birthDate: "2026-10-08" })).toEqual({});
      expect(issues(userCreateInput, { ...create, birthDate: "2026-10-09" }).birthDate).toEqual([
        "La fecha de nacimiento no puede ser futura.",
      ]);
    });
  });

  test("birthDate: blank absent, calendar-valid, not in the future", () => {
    expect(userCreateInput.parse({ ...create, birthDate: "" }).birthDate).toBeUndefined();
    expect(issues(userCreateInput, { ...create, birthDate: today })).toEqual({});
    expect(issues(userCreateInput, { ...create, birthDate: nextYear }).birthDate).toEqual([
      "La fecha de nacimiento no puede ser futura.",
    ]);
    for (const birthDate of ["2025-02-29", "2026-13-01", "2026-02-31", "01/02/2000", "abc"]) {
      expect(issues(userCreateInput, { ...create, birthDate }).birthDate).toEqual([
        "Fecha de nacimiento inválida.",
      ]);
    }
    expect(issues(userCreateInput, { ...create, birthDate: "2000-02-29" })).toEqual({});
  });

  test("gender: M, F, Otro or empty", () => {
    for (const gender of ["M", "F", "Otro"]) {
      expect(issues(userCreateInput, { ...create, gender })).toEqual({});
    }
    expect(userCreateInput.parse({ ...create, gender: "" }).gender).toBeUndefined();
    expect(Object.keys(issues(userCreateInput, { ...create, gender: "X" }))).toEqual(["gender"]);
  });

  test("optional text blank is absent and length capped", () => {
    expect(userCreateInput.parse({ ...create, phone: "  " }).phone).toBeUndefined();
    expect(issues(userCreateInput, { ...create, phone: "1".repeat(30) })).toEqual({});
    expect(issues(userCreateInput, { ...create, phone: "1".repeat(31) }).phone).toEqual([
      "No puede superar 30 caracteres.",
    ]);
    expect(issues(userCreateInput, { ...create, address: "a".repeat(201) }).address).toHaveLength(
      1,
    );
    for (const field of ["country", "department", "municipality"]) {
      expect(issues(userCreateInput, { ...create, [field]: "a".repeat(101) })[field]).toHaveLength(
        1,
      );
    }
  });

  test.each(["coordinator", "teacher", "student", "parent", "viewer"])(
    "role %s accepted",
    (role) => {
      expect(issues(userCreateInput, { ...create, role })).toEqual({});
    },
  );

  test.each(["admin", "owner"])("role %s -> platform-only message", (role) => {
    expect(issues(userCreateInput, { ...create, role }).role).toEqual([
      "Solo la plataforma puede crear administradores.",
    ]);
  });

  test("role missing or unknown", () => {
    expect(issues(userCreateInput, { ...create, role: undefined }).role).toEqual([
      "Debes seleccionar un rol.",
    ]);
    expect(issues(userCreateInput, { ...create, role: "director" }).role).toEqual([
      "Rol inválido.",
    ]);
  });

  test("organizationId is never accepted (tenant comes from the session)", () => {
    const parsed = userCreateInput.parse({ ...create, organizationId: "other" });
    expect("organizationId" in parsed).toBe(false);
  });
});

describe("userEditInput / userUpdateInput", () => {
  const { role: _role, ...edit } = create;

  test("role is not part of the edit input", () => {
    expect("role" in userEditInput.parse({ ...edit, role: "admin" })).toBe(false);
  });

  test("newPassword: blank keeps the current one, otherwise the policy minimum", () => {
    expect(userEditInput.parse({ ...edit, newPassword: "" }).newPassword).toBeUndefined();
    expect(userEditInput.parse({ ...edit }).newPassword).toBeUndefined();
    expect(userEditInput.parse({ ...edit, newPassword: "12345678" }).newPassword).toBe("12345678");
    expect(issues(userEditInput, { ...edit, newPassword: "1234567" }).newPassword).toEqual([
      "La contraseña debe tener al menos 8 caracteres.",
    ]);
  });

  test("update requires personId", () => {
    expect(issues(userUpdateInput, { ...edit }).personId).toHaveLength(1);
    expect(issues(userUpdateInput, { ...edit, personId: "p1" })).toEqual({});
  });
});

describe("userResetPasswordInput (USR-R9)", () => {
  test("document mode needs no password", () => {
    expect(userResetPasswordInput.parse({ personId: "p1", mode: "document" })).toEqual({
      personId: "p1",
      mode: "document",
    });
  });
  test("custom mode requires 8+ characters", () => {
    expect(
      issues(userResetPasswordInput, { personId: "p1", mode: "custom", newPassword: "abc" }),
    ).toEqual({ newPassword: ["La contraseña debe tener al menos 8 caracteres."] });
    expect(
      userResetPasswordInput.parse({ personId: "p1", mode: "custom", newPassword: "abcdefgh" }),
    ).toMatchObject({ newPassword: "abcdefgh" });
  });
  test("custom mode without password and unknown mode fail", () => {
    expect(Object.keys(issues(userResetPasswordInput, { personId: "p1", mode: "custom" }))).toEqual(
      ["newPassword"],
    );
    expect(userResetPasswordInput.safeParse({ personId: "p1", mode: "other" }).success).toBe(false);
  });
});

describe("small inputs", () => {
  test("personId / setActive", () => {
    expect(userPersonInput.safeParse({ personId: "" }).success).toBe(false);
    expect(userSetActiveInput.parse({ personId: "p1", active: false }).active).toBe(false);
    expect(userSetActiveInput.safeParse({ personId: "p1" }).success).toBe(false);
  });

  test("options: role teacher|parent, search, limit <= 50 default 20", () => {
    expect(userOptionsInput.parse({ role: "teacher" })).toMatchObject({ limit: 20 });
    expect(userOptionsInput.parse({ role: "parent", limit: 50 }).limit).toBe(50);
    expect(userOptionsInput.safeParse({ role: "parent", limit: 51 }).success).toBe(false);
    expect(userOptionsInput.safeParse({ role: "parent", limit: 0 }).success).toBe(false);
    expect(userOptionsInput.safeParse({ role: "student" }).success).toBe(false);
    expect(userOptionsInput.safeParse({ role: "admin" }).success).toBe(false);
    expect(userOptionsInput.parse({ role: "teacher", search: "  ana " }).search).toBe("ana");
    expect(userOptionsInput.parse({ role: "teacher", search: "  " }).search).toBeUndefined();
  });

  test("previewUsername accepts empty parts (server answers null)", () => {
    expect(
      userPreviewUsernameInput.parse({ firstName: "", lastName: "", documentNumber: "" }),
    ).toEqual({
      firstName: "",
      lastName: "",
      documentNumber: "",
    });
    expect(
      userPreviewUsernameInput.safeParse({
        firstName: "a".repeat(101),
        lastName: "",
        documentNumber: "",
      }).success,
    ).toBe(false);
  });

  test("checkEmail trims and lowercases; invalid reports the message", () => {
    expect(userCheckEmailInput.parse({ email: " A@B.co " }).email).toBe("a@b.co");
    expect(issues(userCheckEmailInput, { email: "x" }).email).toEqual([
      "Ingresa un correo válido.",
    ]);
  });
});
