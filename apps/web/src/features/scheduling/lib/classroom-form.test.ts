import { describe, expect, test } from "bun:test";

import {
  CLASSROOM_FIELD_BY_MESSAGE,
  CLASSROOM_FIELDS,
  classroomFormSchema,
  classroomToFormValues,
  emptyClassroomForm,
  parseResourcesText,
  resourcesToText,
  toClassroomInput,
} from "./classroom-form";

const valid = { ...emptyClassroomForm, campusId: "c1", name: " Aula 101 ", code: "AULA-101" };

function messages(values: Parameters<typeof classroomFormSchema.safeParse>[0]) {
  const result = classroomFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("toClassroomInput", () => {
  test("trims text, uses the defaults and omits blank optionals", () => {
    expect(toClassroomInput(valid)).toEqual({
      campusId: "c1",
      name: "Aula 101",
      code: "AULA-101",
      capacity: 40,
      floor: 1,
      classroomType: "aula",
      resources: null,
    });
  });

  test("parses numbers, the building and a JSON object", () => {
    expect(
      toClassroomInput({
        ...valid,
        capacity: "30",
        floor: "3",
        classroomType: "laboratorio",
        building: " B ",
        resources: '{"proyector": true, "computadoras": 30}',
      }),
    ).toMatchObject({
      capacity: 30,
      floor: 3,
      classroomType: "laboratorio",
      building: "B",
      resources: { proyector: true, computadoras: 30 },
    });
  });

  test("blank capacity and floor take the API defaults", () => {
    expect(toClassroomInput({ ...valid, capacity: "  ", floor: "" })).toMatchObject({
      capacity: 40,
      floor: 1,
    });
  });
});

describe("classroomFormSchema messages", () => {
  test("reports the spec messages for required fields", () => {
    expect(messages({ ...emptyClassroomForm })).toEqual([
      "Debes seleccionar una sede.",
      "El nombre es obligatorio.",
      "El código es obligatorio.",
    ]);
  });

  test("capacity and floor bounds", () => {
    expect(messages({ ...valid, capacity: "9" })).toEqual([
      "La capacidad debe estar entre 10 y 100.",
    ]);
    expect(messages({ ...valid, capacity: "101" })).toEqual([
      "La capacidad debe estar entre 10 y 100.",
    ]);
    expect(messages({ ...valid, capacity: "12.5" })).toEqual([
      "La capacidad debe estar entre 10 y 100.",
    ]);
    expect(messages({ ...valid, floor: "0" })).toEqual(["El piso debe ser 1 o mayor."]);
  });

  test("rejects text that is not a JSON object", () => {
    for (const resources of ["{proyector: true}", "[1, 2]", "42", '"texto"', "true"]) {
      expect(messages({ ...valid, resources })).toEqual(["El formato JSON no es válido."]);
    }
  });

  test("blank resources are allowed", () => {
    expect(messages({ ...valid, resources: "   " })).toEqual([]);
  });

  test("an unknown type asks for a selection", () => {
    expect(messages({ ...valid, classroomType: "" })).toEqual(["Debes seleccionar un tipo."]);
  });
});

describe("resources text", () => {
  test("parses blank to none, JSON as parsed and other text as itself", () => {
    expect(parseResourcesText("  ")).toBeNull();
    expect(parseResourcesText('{"a": 1}')).toEqual({ a: 1 });
    expect(parseResourcesText("nope") as unknown).toBe("nope");
  });

  test("stored resources round-trip through the textarea", () => {
    expect(resourcesToText(null)).toBe("");
    const text = resourcesToText({ proyector: true });
    expect(parseResourcesText(text)).toEqual({ proyector: true });
  });
});

describe("classroomToFormValues", () => {
  test("turns a row into string controls", () => {
    expect(
      classroomToFormValues({
        id: "r1",
        campusId: "c1",
        campusName: "Principal",
        name: "Lab 1",
        code: "LAB-1",
        capacity: 25,
        floor: 2,
        building: null,
        classroomType: "laboratorio",
        resources: null,
      }),
    ).toEqual({
      campusId: "c1",
      name: "Lab 1",
      code: "LAB-1",
      capacity: "25",
      floor: "2",
      classroomType: "laboratorio",
      building: "",
      resources: "",
    });
  });
});

describe("server message mapping", () => {
  test("every mapped field is rendered by the form", () => {
    for (const field of Object.values(CLASSROOM_FIELD_BY_MESSAGE)) {
      expect(CLASSROOM_FIELDS as readonly string[]).toContain(field);
    }
  });
});
