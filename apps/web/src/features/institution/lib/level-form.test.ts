import { describe, expect, test } from "bun:test";

import {
  campusChoices,
  campusOptionLabel,
  levelFormSchema,
  levelToFormValues,
  toLevelInput,
  toLevelUpdate,
} from "./level-form";

const level = {
  id: "l1",
  campusId: "c1",
  campusName: "Sede Norte",
  name: "Sexto",
  orderNum: 6,
  courseCount: 2,
};

function messages(values: Parameters<typeof levelFormSchema.safeParse>[0]) {
  const result = levelFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("level form", () => {
  test("turns the order text into a number, blank meaning 0", () => {
    expect(toLevelInput({ campusId: "c1", name: " Primero ", orderNum: "1" })).toEqual({
      campusId: "c1",
      name: "Primero",
      orderNum: 1,
    });
    expect(toLevelInput({ campusId: "c1", name: "Primero", orderNum: " " }).orderNum).toBe(0);
  });

  test("shows the spec messages for name and order", () => {
    expect(messages({ campusId: "c1", name: " ", orderNum: "0" })).toEqual([
      "El nombre del nivel es obligatorio.",
    ]);
    for (const orderNum of ["-1", "1.5", "abc"]) {
      expect(messages({ campusId: "c1", name: "A", orderNum })).toEqual([
        "El orden debe ser un entero desde 0.",
      ]);
    }
  });

  test("requires a campus", () => {
    expect(messages({ campusId: "", name: "A", orderNum: "0" })).toEqual([
      "Debes seleccionar una sede.",
    ]);
  });

  test("an edit sends no campus", () => {
    expect(levelToFormValues(level)).toEqual({ campusId: "c1", name: "Sexto", orderNum: "6" });
    expect(toLevelUpdate(toLevelInput(levelToFormValues(level)))).toEqual({
      name: "Sexto",
      orderNum: 6,
    });
  });
});

describe("campus select", () => {
  const options = [
    { id: "c0", name: "Sede Principal", isMain: true },
    { id: "c2", name: "Sede Sur", isMain: false },
  ];

  test("marks the main campus", () => {
    expect(campusOptionLabel(options[0]!)).toBe("Sede Principal (Principal)");
    expect(campusOptionLabel(options[1]!)).toBe("Sede Sur");
  });

  test("keeps the options, adding the level's own campus when it is no longer active", () => {
    expect(campusChoices(options)).toEqual(options);
    expect(campusChoices(options, { campusId: "c2", campusName: "Sede Sur" })).toEqual(options);
    expect(campusChoices(options, { campusId: "c1", campusName: "Sede Norte" })).toEqual([
      ...options,
      { id: "c1", name: "Sede Norte", isMain: false },
    ]);
  });
});
