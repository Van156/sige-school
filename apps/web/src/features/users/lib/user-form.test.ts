import { describe, expect, test } from "bun:test";

import { mapSubmitError } from "@/features/institution";

import type { UserDetail } from "../types";
import {
  countryOptions,
  createUserFormSchema,
  editUserFormSchema,
  emptyUserForm,
  toUserCreateInput,
  toUserUpdateInput,
  userCreateSearchSchema,
  USER_CREATE_FALLBACK,
  USER_FIELD_BY_MESSAGE,
  USER_FORM_FIELDS,
  userToFormValues,
  type UserFormValues,
} from "./user-form";

const detail: UserDetail = {
  personId: "p1",
  userId: "u1",
  username: "agomez1234",
  email: "ana@colegio.edu.co",
  firstName: "Ana",
  lastName: "Gómez",
  name: "Ana Gómez",
  role: "teacher",
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-01-10T00:00:00.000Z",
  isSelf: false,
  documentType: "CE",
  documentNumber: "A1234567",
  birthDate: "1990-05-17",
  gender: "F",
  phone: "3001234567",
  address: "Calle 1 # 2-3",
  country: "México",
  department: "Cundinamarca",
  municipality: "Bogotá",
  hasRealEmail: true,
  studentId: null,
};

function filled(overrides: Partial<UserFormValues> = {}): UserFormValues {
  return {
    ...emptyUserForm("teacher"),
    firstName: "Juan",
    lastName: "Pérez",
    documentNumber: "1101234501",
    ...overrides,
  };
}

describe("emptyUserForm", () => {
  test("defaults to CC and Colombia with no role", () => {
    expect(emptyUserForm()).toMatchObject({ documentType: "CC", country: "Colombia", role: "" });
  });

  test("preselects an assignable ?role= and ignores anything else", () => {
    expect(emptyUserForm("student").role).toBe("student");
    expect(emptyUserForm("admin").role).toBe("");
    expect(emptyUserForm("nope").role).toBe("");
  });
});

describe("create validation", () => {
  test("accepts a complete form", () => {
    expect(createUserFormSchema.safeParse(filled()).success).toBe(true);
  });

  test("a missing role asks to select one", () => {
    const result = createUserFormSchema.safeParse(filled({ role: "" }));
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Debes seleccionar un rol.",
    ]);
  });

  test("uses the API messages for names, document and email", () => {
    const result = createUserFormSchema.safeParse(
      filled({ firstName: " ", lastName: "", documentNumber: "12", email: "nope" }),
    );
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Los nombres son obligatorios.",
      "Los apellidos son obligatorios.",
      "El documento debe tener al menos 5 caracteres.",
      "Ingresa un correo válido.",
    ]);
  });

  test("rejects a future birth date", () => {
    const result = createUserFormSchema.safeParse(filled({ birthDate: "2999-01-01" }));
    expect(result.error?.issues[0]?.message).toBe("La fecha de nacimiento no puede ser futura.");
  });
});

describe("toUserCreateInput", () => {
  test("omits blank optional fields and keeps the role and country", () => {
    expect(toUserCreateInput(filled({ email: "Ana@Colegio.edu.co" }))).toEqual({
      firstName: "Juan",
      lastName: "Pérez",
      documentType: "CC",
      documentNumber: "1101234501",
      email: "ana@colegio.edu.co",
      country: "Colombia",
      role: "teacher",
    });
  });
});

describe("edit validation", () => {
  test("a blank new password is accepted and a short one is refused with the policy message", () => {
    const base = userToFormValues(detail);
    expect(editUserFormSchema.safeParse(base).success).toBe(true);
    const short = editUserFormSchema.safeParse({ ...base, newPassword: "abc" });
    expect(short.error?.issues[0]?.message).toBe("La contraseña debe tener al menos 8 caracteres.");
  });
});

describe("editUserFormSchema.shape.newPassword", () => {
  const field = editUserFormSchema.shape.newPassword;

  test("accepts a blank value (the password stays unchanged)", () => {
    expect(field.safeParse("").success).toBe(true);
  });

  test("rejects a short password", () => {
    expect(field.safeParse("corta").success).toBe(false);
  });

  test("rejects whitespace only, like the server: it is not blank to the API schema", () => {
    // `blankToUndefined` only maps the empty string; "   " reaches the password policy and fails.
    expect(field.safeParse("   ").success).toBe(false);
  });
});

describe("userToFormValues", () => {
  test("prefills every field from the detail", () => {
    expect(userToFormValues(detail)).toEqual({
      firstName: "Ana",
      lastName: "Gómez",
      documentType: "CE",
      documentNumber: "A1234567",
      birthDate: "1990-05-17",
      gender: "F",
      email: "ana@colegio.edu.co",
      phone: "3001234567",
      address: "Calle 1 # 2-3",
      country: "México",
      department: "Cundinamarca",
      municipality: "Bogotá",
      role: "teacher",
      newPassword: "",
    });
  });

  test("null fields and a placeholder email become empty strings", () => {
    const values = userToFormValues({
      ...detail,
      hasRealEmail: false,
      email: "agomez1234@sede.invalid",
      birthDate: null,
      gender: null,
      phone: null,
      address: null,
      country: null,
      department: null,
      municipality: null,
    });
    expect(values).toMatchObject({
      email: "",
      birthDate: "",
      gender: "",
      phone: "",
      address: "",
      country: "",
      department: "",
      municipality: "",
    });
  });
});

describe("toUserUpdateInput (full replace)", () => {
  test("sends every prefilled field, country included, and no password when blank", () => {
    expect(toUserUpdateInput("p1", userToFormValues(detail))).toEqual({
      personId: "p1",
      firstName: "Ana",
      lastName: "Gómez",
      documentType: "CE",
      documentNumber: "A1234567",
      birthDate: "1990-05-17",
      gender: "F",
      email: "ana@colegio.edu.co",
      phone: "3001234567",
      address: "Calle 1 # 2-3",
      country: "México",
      department: "Cundinamarca",
      municipality: "Bogotá",
    });
  });

  test("a changed document does not send a password (D2)", () => {
    const input = toUserUpdateInput("p1", {
      ...userToFormValues(detail),
      documentNumber: "B7654321",
    });
    expect(input.documentNumber).toBe("B7654321");
    expect(input.newPassword).toBeUndefined();
  });

  test("a cleared optional field is dropped so the server clears it", () => {
    const input = toUserUpdateInput("p1", { ...userToFormValues(detail), phone: "", country: "" });
    expect(input.phone).toBeUndefined();
    expect(input.country).toBeUndefined();
  });

  test("an optional new password is sent when filled", () => {
    const input = toUserUpdateInput("p1", {
      ...userToFormValues(detail),
      newPassword: "nueva-clave-1",
    });
    expect(input.newPassword).toBe("nueva-clave-1");
  });
});

describe("countryOptions", () => {
  test("offers the spec list behind a blank option", () => {
    expect(countryOptions("Colombia").map((option) => option.value)).toEqual([
      "",
      "Colombia",
      "México",
      "Venezuela",
      "Ecuador",
      "Perú",
      "Otro",
    ]);
  });

  test("keeps a stored value that is not in the list", () => {
    expect(countryOptions("Chile").at(-1)).toEqual({ value: "Chile", label: "Chile" });
  });
});

describe("userCreateSearchSchema", () => {
  test("keeps an assignable role and drops anything else", () => {
    expect(userCreateSearchSchema.parse({ role: "parent" })).toEqual({ role: "parent" });
    expect(userCreateSearchSchema.parse({ role: "admin" })).toEqual({ role: undefined });
    expect(userCreateSearchSchema.parse({})).toEqual({});
  });
});

describe("server conflicts on the user form", () => {
  const map = (message: string) =>
    mapSubmitError(
      { code: "CONFLICT", message },
      {
        fields: USER_FORM_FIELDS,
        fieldByMessage: USER_FIELD_BY_MESSAGE,
        fallback: USER_CREATE_FALLBACK,
      },
    );

  test("a taken document goes under the document number", () => {
    const message = "Ya existe un usuario con este documento.";
    expect(map(message)).toEqual({ fieldErrors: { documentNumber: message }, formError: null });
  });

  test("a taken email goes under the email", () => {
    const message = "Ya existe un usuario con este correo.";
    expect(map(message)).toEqual({ fieldErrors: { email: message }, formError: null });
  });

  test("the admin-only refusal goes under the role", () => {
    const message = "Solo la plataforma puede crear administradores.";
    expect(map(message)).toEqual({ fieldErrors: { role: message }, formError: null });
  });
});
