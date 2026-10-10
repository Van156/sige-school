import { describe, expect, test } from "bun:test";

import type { StudentDetail } from "../types";
import {
  admissionNotice,
  courseAfterCampusSelect,
  courseChoices,
  currentYearCourses,
  emptyStudentForm,
  hasCourseChanged,
  OVER_CAPACITY_FALLBACK,
  overCapacityWarning,
  statusChoices,
  studentFormSchemas,
  studentToFormValues,
  toStudentCompleteInput,
  toStudentCreateInput,
  toStudentUpdateInput,
  type StudentFormValues,
} from "./student-form";

const FILLED: StudentFormValues = {
  ...emptyStudentForm(),
  firstName: " Laura ",
  lastName: "Pérez",
  documentNumber: "1023456789",
  campusId: "campus-1",
  courseId: "course-1",
  stratum: "3",
  guardianEmail: "Madre@Correo.com",
};

const COURSES = [
  { id: "course-1", name: "6-01", campusId: "campus-1" },
  { id: "course-2", name: "6-02", campusId: "campus-1" },
  { id: "course-3", name: "3-01", campusId: "campus-2" },
];

function issuesOf(mode: keyof typeof studentFormSchemas, values: StudentFormValues) {
  const result = studentFormSchemas[mode].safeParse(values);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}

describe("form rules per mode (sige/05 §4.1)", () => {
  test("new requires names, a 5-character document and a campus", () => {
    expect(issuesOf("create", emptyStudentForm())).toEqual({
      firstName: "El nombre es obligatorio.",
      lastName: "El apellido es obligatorio.",
      documentNumber: "El documento debe tener al menos 5 dígitos.",
      campusId: "Debes seleccionar una sede.",
    });
  });

  test("complete checks only the academic fields (personal data is not rendered)", () => {
    expect(issuesOf("complete", emptyStudentForm())).toEqual({
      campusId: "Debes seleccionar una sede.",
    });
  });

  test("edit checks names and campus but not the immutable document", () => {
    expect(issuesOf("edit", { ...emptyStudentForm(), documentNumber: "" })).toEqual({
      firstName: "El nombre es obligatorio.",
      lastName: "El apellido es obligatorio.",
      campusId: "Debes seleccionar una sede.",
    });
  });

  test("stratum is empty or an integer 1..6; the guardian email must be valid", () => {
    for (const stratum of ["0", "7", "2.5", "abc"]) {
      expect(issuesOf("complete", { ...FILLED, stratum }).stratum).toBe(
        "El estrato debe estar entre 1 y 6.",
      );
    }
    expect(issuesOf("complete", { ...FILLED, stratum: "" })).toEqual({});
    expect(issuesOf("complete", { ...FILLED, guardianEmail: "no-es-correo" }).guardianEmail).toBe(
      "Ingresa un correo válido.",
    );
  });

  test("a future birth date is refused", () => {
    expect(issuesOf("create", { ...FILLED, birthDate: "2999-01-01" }).birthDate).toBe(
      "La fecha de nacimiento no puede ser futura.",
    );
  });
});

describe("form → API mapping", () => {
  test("create trims, omits blank optional fields and sends the stratum as a number", () => {
    expect(toStudentCreateInput(FILLED)).toEqual({
      firstName: "Laura",
      lastName: "Pérez",
      documentType: "TI",
      documentNumber: "1023456789",
      campusId: "campus-1",
      courseId: "course-1",
      stratum: 3,
      guardianEmail: "madre@correo.com",
    });
  });

  test("'Sin asignar' and a blank stratum are null", () => {
    expect(toStudentCreateInput({ ...FILLED, courseId: "", stratum: "" })).toMatchObject({
      courseId: null,
      stratum: null,
    });
  });

  test("complete sends the person and only academic fields", () => {
    expect(toStudentCompleteInput("person-1", FILLED)).toEqual({
      personId: "person-1",
      campusId: "campus-1",
      courseId: "course-1",
      stratum: 3,
      guardianEmail: "madre@correo.com",
    });
  });

  test("update sends no document and leaves blank fields absent (the server clears them)", () => {
    const input = toStudentUpdateInput("student-1", {
      ...FILLED,
      eps: "",
      phone: "",
      status: "retirado",
    });
    expect(input).toEqual({
      id: "student-1",
      firstName: "Laura",
      lastName: "Pérez",
      campusId: "campus-1",
      courseId: "course-1",
      stratum: 3,
      guardianEmail: "madre@correo.com",
      status: "retirado",
    });
    expect("documentNumber" in input).toBe(false);
  });

  test("edit values from student.get round-trip; nulls become empty strings", () => {
    const detail: StudentDetail = {
      id: "student-1",
      personId: "person-1",
      name: "Laura Pérez",
      firstName: "Laura",
      lastName: "Pérez",
      documentType: "TI",
      documentNumber: "1023456789",
      courseId: null,
      courseName: null,
      campusId: "campus-1",
      campusName: "Principal",
      status: "graduado",
      guardianName: null,
      username: "lperez6789",
      email: null,
      phone: null,
      birthDate: "2012-04-01",
      gender: "F",
      address: null,
      neighborhood: null,
      stratum: 2,
      bloodType: null,
      eps: "Sanitas",
      guardianPhone: null,
      guardianEmail: null,
      enrolledYear: "2026",
      guardians: [],
    };
    const values = studentToFormValues(detail);
    expect(values).toMatchObject({ courseId: "", stratum: "2", gender: "F", status: "graduado" });
    expect(toStudentUpdateInput(detail.id, values)).toEqual({
      id: "student-1",
      firstName: "Laura",
      lastName: "Pérez",
      birthDate: "2012-04-01",
      gender: "F",
      campusId: "campus-1",
      courseId: null,
      stratum: 2,
      eps: "Sanitas",
      status: "graduado",
    });
  });
});

describe("campus → course (STU-R4)", () => {
  test("only courses of the current academic year are offered", () => {
    expect(
      currentYearCourses(
        [
          { id: "course-1", name: "6-01", campusId: "campus-1", academicYear: "2026" },
          { id: "course-old", name: "6-01", campusId: "campus-1", academicYear: "2025" },
        ],
        "2026",
      ),
    ).toEqual([{ id: "course-1", name: "6-01", campusId: "campus-1" }]);
  });

  test("course choices follow the chosen campus; none before a campus", () => {
    expect(courseChoices(COURSES, "campus-1").map((option) => option.label)).toEqual([
      "6-01",
      "6-02",
    ]);
    expect(courseChoices(COURSES, "")).toEqual([]);
  });

  test("the current course stays offered when the options no longer list it", () => {
    const old = { id: "course-old", name: "6-01 (2025)", campusId: "campus-1" };
    expect(courseChoices(COURSES, "campus-1", old).map((option) => option.value)).toEqual([
      "course-1",
      "course-2",
      "course-old",
    ]);
    expect(courseChoices(COURSES, "campus-2", old).map((option) => option.value)).toEqual([
      "course-3",
    ]);
  });

  test("a campus change keeps the course only when it belongs to the new campus", () => {
    expect(courseAfterCampusSelect("course-1", "campus-1", COURSES)).toBe("course-1");
    expect(courseAfterCampusSelect("course-1", "campus-2", COURSES)).toBe("");
    expect(courseAfterCampusSelect("", "campus-2", COURSES)).toBe("");
    expect(courseAfterCampusSelect("unknown", "campus-1", COURSES)).toBe("");
  });

  test("the help shows once the course differs from the stored one", () => {
    expect(hasCourseChanged("course-1", "course-1")).toBe(false);
    expect(hasCourseChanged("course-1", "")).toBe(true);
  });
});

describe("status choices (STU-R5, D9)", () => {
  test("only allowed transitions are offered, current first in enum order", () => {
    expect(statusChoices("activo").map((option) => option.value)).toEqual([
      "activo",
      "retirado",
      "graduado",
    ]);
    expect(statusChoices("retirado")).toEqual([
      { value: "activo", label: "Activo" },
      { value: "retirado", label: "Retirado" },
    ]);
    expect(statusChoices("graduado").map((option) => option.value)).toEqual(["activo", "graduado"]);
  });
});

describe("admission toasts (STU-R3)", () => {
  test("with and without a course", () => {
    expect(admissionNotice(null)).toEqual({
      title: "Matrícula completada",
      description: "Asigna un grado desde Matrículas para inscribirlo en materias.",
    });
    expect(admissionNotice({ created: 8, overCapacity: false }).description).toBe(
      "El estudiante quedó inscrito en las materias de su grado.",
    );
  });

  test("over capacity warns with the course capacity", () => {
    expect(overCapacityWarning(null, 40)).toBeNull();
    expect(overCapacityWarning({ created: 8, overCapacity: false }, 40)).toBeNull();
    expect(overCapacityWarning({ created: 8, overCapacity: true }, 40)).toBe(
      "El grado supera su capacidad máxima (40 estudiantes).",
    );
    expect(overCapacityWarning({ created: 8, overCapacity: true }, null)).toBe(
      OVER_CAPACITY_FALLBACK,
    );
  });
});
