import {
  ASSIGNMENT_OFFERING_FK,
  ASSIGNMENT_OFFERING_UNIQUE,
  CAMPUS_CODE_UNIQUE,
  CLASSROOM_CAMPUS_FK,
  CLASSROOM_CODE_UNIQUE,
  CAMPUS_MAIN_UNIQUE,
  COURSE_CAMPUS_FK,
  COURSE_DIRECTOR_FK,
  COURSE_LEVEL_CAMPUS_FK,
  COURSE_UNIQUE,
  IMPORT_JOB_RUNNING_UNIQUE,
  INSTITUTION_NIT_UNIQUE,
  LEVEL_CAMPUS_FK,
  LEVEL_NAME_UNIQUE,
  OFFERING_COURSE_FK,
  OFFERING_SUBJECT_FK,
  OFFERING_TEACHER_FK,
  OFFERING_UNIQUE,
  PERIOD_ACTIVE_UNIQUE,
  SLOT_CLASSROOM_EXCLUDE,
  SLOT_CLASSROOM_FK,
  SLOT_COURSE_EXCLUDE,
  SLOT_OFFERING_COURSE_FK,
  SLOT_TEACHER_EXCLUDE,
  SLOT_TEACHER_SYNC_CHECK,
  SUBJECT_CODE_UNIQUE,
  TIME_BLOCK_CAMPUS_FK,
  TIME_BLOCK_UNIQUE,
} from "@base-template/db/schema";
import { ORPCError } from "@orpc/server";
import { describe, expect, test } from "bun:test";

import {
  OFFERING_HAS_SLOTS_MESSAGE,
  TIME_BLOCK_IN_USE_MESSAGE,
  mapDbError,
  rethrowDbError,
} from "./pg-errors";

const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error("pg"), { code, constraint });

/** Drizzle wraps driver errors: the pg error sits in `cause`. */
const wrapped = (inner: Error) => Object.assign(new Error("Failed query"), { cause: inner });

function mapped(error: unknown, operation: "write" | "delete") {
  const result = mapDbError(error, operation);
  expect(result).toBeInstanceOf(ORPCError);
  return result as ORPCError<string, unknown>;
}

describe("unique violations (23505) -> CONFLICT", () => {
  test.each([
    [CAMPUS_MAIN_UNIQUE, "Ya existe una sede principal en esta institución."],
    [CAMPUS_CODE_UNIQUE, "Ya existe una sede con este código."],
    [LEVEL_NAME_UNIQUE, "Ya existe un nivel con este nombre en la sede."],
    [COURSE_UNIQUE, "Ya existe un grado con la misma sede, nombre, año y jornada."],
    [SUBJECT_CODE_UNIQUE, "Ya existe una asignatura con este código."],
    [INSTITUTION_NIT_UNIQUE, "Ya existe una institución con este NIT."],
    [IMPORT_JOB_RUNNING_UNIQUE, "Ya hay una importación en curso."],
  ])("%s", (constraint, message) => {
    const error = mapped(pgError("23505", constraint), "write");
    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
    expect(error.message).toBe(message);
  });

  test("period constraints map to CONFLICT", () => {
    expect(mapped(pgError("23505", PERIOD_ACTIVE_UNIQUE), "write").code).toBe("CONFLICT");
  });

  test("a unique violation on an unknown constraint is not mapped", () => {
    expect(mapDbError(pgError("23505", "some_other_unique"), "write")).toBeNull();
  });
});

describe("restrict (23001) and FK (23503) on delete -> HAS_DEPENDENTS", () => {
  test.each([
    ["23001", LEVEL_CAMPUS_FK, "La sede tiene niveles o grados asociados."],
    ["23503", LEVEL_CAMPUS_FK, "La sede tiene niveles o grados asociados."],
    ["23001", COURSE_CAMPUS_FK, "La sede tiene niveles o grados asociados."],
    ["23001", COURSE_LEVEL_CAMPUS_FK, "El nivel tiene cursos asociados."],
    ["23503", COURSE_LEVEL_CAMPUS_FK, "El nivel tiene cursos asociados."],
    ["23001", "unknown_future_fk", "El registro tiene elementos asociados."],
    ["23503", undefined, "El registro tiene elementos asociados."],
  ])("%s on %s", (code, constraint, message) => {
    const error = mapped(pgError(code, constraint), "delete");
    expect(error.code).toBe("HAS_DEPENDENTS");
    expect(error.status).toBe(409);
    expect(error.message).toBe(message);
  });
});

describe("FK violation (23503) on insert/update", () => {
  test("level outside the campus -> BAD_REQUEST", () => {
    const error = mapped(pgError("23503", COURSE_LEVEL_CAMPUS_FK), "write");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("El nivel no pertenece a la sede seleccionada.");
  });
  test("missing campus -> NOT_FOUND", () => {
    for (const constraint of [LEVEL_CAMPUS_FK, COURSE_CAMPUS_FK]) {
      const error = mapped(pgError("23503", constraint), "write");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("La sede no existe.");
    }
  });
  test("director -> BAD_REQUEST", () => {
    const error = mapped(pgError("23503", COURSE_DIRECTOR_FK), "write");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("El director debe ser un profesor activo de la institución.");
  });
  test("unknown FK -> BAD_REQUEST generic", () => {
    expect(mapped(pgError("23503", "x_fk"), "write").code).toBe("BAD_REQUEST");
  });
  test("23001 is not an insert error", () => {
    expect(mapDbError(pgError("23001", LEVEL_CAMPUS_FK), "write")).toBeNull();
  });
});

describe("error unwrapping and passthrough", () => {
  test("finds the pg error inside drizzle's cause chain", () => {
    const error = mapped(wrapped(wrapped(pgError("23505", CAMPUS_MAIN_UNIQUE))), "write");
    expect(error.code).toBe("CONFLICT");
  });
  test("unknown errors are not mapped and rethrown unchanged", () => {
    const unknown = new Error("boom");
    expect(mapDbError(unknown, "write")).toBeNull();
    expect(mapDbError(pgError("42P01"), "delete")).toBeNull();
    expect(mapDbError("string", "write")).toBeNull();
    expect(() => rethrowDbError(unknown, "write")).toThrow(unknown);
  });
  test("rethrowDbError throws the mapped ORPCError", () => {
    expect(() => rethrowDbError(pgError("23001", LEVEL_CAMPUS_FK), "delete")).toThrow(
      "La sede tiene niveles o grados asociados.",
    );
  });
  test("an existing ORPCError passes through untouched", () => {
    const own = new ORPCError("NOT_FOUND");
    expect(() => rethrowDbError(own, "write")).toThrow(own);
  });
});

describe("user constraints (sige/03 USR-R7)", () => {
  test.each([
    ["person_organizationId_documentNumber_unique", "Ya existe un usuario con este documento."],
    ["user_email_key", "Ya existe un usuario con este correo."],
    ["user_username_key", "Ya existe un usuario con este nombre de usuario."],
  ])("unique %s -> CONFLICT", (constraint, message) => {
    const error = mapped(pgError("23505", constraint), "write");
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe(message);
  });

  test.each([
    ["teacher", COURSE_DIRECTOR_FK, "El profesor tiene asignaturas o grupos a cargo."],
    [
      "student",
      "some_future_fk",
      "El estudiante tiene un perfil académico con notas y matrículas.",
    ],
    ["parent", "some_future_fk", "El acudiente tiene estudiantes vinculados."],
    ["viewer", "some_future_fk", "El usuario tiene registros asociados. Desactívelo en su lugar."],
    [
      "teacher",
      "import_job_creator_fk",
      "El usuario tiene registros asociados. Desactívelo en su lugar.",
    ],
  ])("deleting a %s blocked by %s -> HAS_DEPENDENTS with the role message", (role, fk, message) => {
    const error = mapDbError(pgError("23001", fk), "delete", { personRole: role });
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe(message);
  });
});

describe("scheduling constraints (sige/04 §4.1, §4.2, SCH-R9)", () => {
  test.each([
    [CLASSROOM_CODE_UNIQUE, "Ya existe un salón con este código en la sede."],
    [TIME_BLOCK_UNIQUE, "Ya existe un bloque con este nombre en la sede y jornada."],
    [OFFERING_UNIQUE, "La materia ya está asignada a este grado."],
    [ASSIGNMENT_OFFERING_UNIQUE, "La materia del grado ya tiene una asignación."],
  ])("unique %s -> CONFLICT", (constraint, message) => {
    const error = mapped(pgError("23505", constraint), "write");
    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
    expect(error.message).toBe(message);
  });

  test.each([
    [SLOT_TEACHER_EXCLUDE, "El profesor ya tiene clases en el mismo horario."],
    [SLOT_CLASSROOM_EXCLUDE, "El salón ya está ocupado en el mismo horario."],
    [SLOT_COURSE_EXCLUDE, "El grado ya tiene clases en el mismo horario."],
  ])("exclusion %s (23P01) -> CONFLICT on write and delete paths", (constraint, message) => {
    for (const operation of ["write", "delete"] as const) {
      const error = mapped(wrapped(pgError("23P01", constraint)), operation);
      expect(error.code).toBe("CONFLICT");
      expect(error.status).toBe(409);
      expect(error.message).toBe(message);
    }
  });

  test("an unknown exclusion constraint is not mapped", () => {
    expect(mapDbError(pgError("23P01", "other_excl"), "write")).toBeNull();
    expect(mapDbError(pgError("23P01"), "write")).toBeNull();
  });

  test.each([
    [OFFERING_COURSE_FK, "El grado tiene asignaturas asignadas."],
    [OFFERING_SUBJECT_FK, "La asignatura está asignada a uno o más grados."],
    [OFFERING_TEACHER_FK, "El profesor tiene asignaturas o grupos a cargo."],
    [CLASSROOM_CAMPUS_FK, "La sede tiene salones o bloques horarios asociados."],
    [TIME_BLOCK_CAMPUS_FK, "La sede tiene salones o bloques horarios asociados."],
    [SLOT_CLASSROOM_FK, "El salón tiene clases programadas en el horario."],
  ])("restrict on %s -> HAS_DEPENDENTS", (constraint, message) => {
    const error = mapped(pgError("23001", constraint), "delete");
    expect(error.code).toBe("HAS_DEPENDENTS");
    expect(error.message).toBe(message);
  });

  test("deleting a teacher with offerings uses the role message", () => {
    const error = mapDbError(pgError("23001", OFFERING_TEACHER_FK), "delete", {
      personRole: "teacher",
    });
    expect(error?.code).toBe("HAS_DEPENDENTS");
    expect(error?.message).toBe("El profesor tiene asignaturas o grupos a cargo.");
  });

  test("offering-with-slots and block-in-use copy is exported for service pre-checks", () => {
    expect(OFFERING_HAS_SLOTS_MESSAGE).toBe(
      "La materia del grado tiene clases programadas en el horario.",
    );
    expect(TIME_BLOCK_IN_USE_MESSAGE).toBe("El bloque tiene clases programadas en el horario.");
  });

  test.each([
    [OFFERING_SUBJECT_FK, "NOT_FOUND", "La materia no existe."],
    [OFFERING_COURSE_FK, "NOT_FOUND", "El grado no existe."],
    [OFFERING_TEACHER_FK, "NOT_FOUND", "El profesor no existe."],
    [CLASSROOM_CAMPUS_FK, "NOT_FOUND", "La sede no existe."],
    [TIME_BLOCK_CAMPUS_FK, "NOT_FOUND", "La sede no existe."],
    [SLOT_CLASSROOM_FK, "NOT_FOUND", "El salón no existe."],
    [
      ASSIGNMENT_OFFERING_FK,
      "BAD_REQUEST",
      "La asignación debe corresponder a la materia del grado y a su profesor.",
    ],
  ])("FK %s on write -> %s", (constraint, code, message) => {
    const error = mapped(pgError("23503", constraint), "write");
    expect(error.code).toBe(code);
    expect(error.message).toBe(message);
  });

  test("slot course and teacher mismatches fall back to the generic BAD_REQUEST", () => {
    expect(mapped(pgError("23503", SLOT_OFFERING_COURSE_FK), "write").code).toBe("BAD_REQUEST");
  });

  test("the teacher-sync check (23514) is not mapped here", () => {
    expect(mapDbError(pgError("23514", SLOT_TEACHER_SYNC_CHECK), "write")).toBeNull();
  });
});
