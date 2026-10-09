import { describe, expect, test } from "bun:test";

import {
  criterionFormSchema,
  criterionToFormValues,
  criterionUpdatedMessage,
  emptyCriterionForm,
  nextCriterionOrder,
  toCriterionInput,
  totalWithCriterion,
} from "./criterion-form";

const rows = [
  { id: "a", name: "Seguimiento", weight: 20, description: null, orderNum: 1 },
  { id: "b", name: "Formativo", weight: 20.5, description: "Tareas", orderNum: 2 },
];

function messages(values: Parameters<typeof criterionFormSchema.safeParse>[0]) {
  const result = criterionFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("criterion form", () => {
  test("parses weight and order, treating a blank description as absent", () => {
    expect(
      toCriterionInput({ name: " Cognitivo ", weight: "30.5", description: " ", orderNum: "3" }),
    ).toEqual({ name: "Cognitivo", weight: 30.5, description: undefined, orderNum: 3 });
  });

  test("shows the API messages for weight and order", () => {
    const base = { name: "X", weight: "10", description: "", orderNum: "1" };
    expect(messages({ ...base, weight: "" })).toEqual(["El peso es obligatorio."]);
    expect(messages({ ...base, weight: "abc" })).toEqual(["El peso debe ser un número válido."]);
    expect(messages({ ...base, weight: "0" })).toEqual([
      "El peso debe ser mayor a 0 y menor o igual a 100.",
    ]);
    expect(messages({ ...base, weight: "100.01" })).toEqual([
      "El peso debe ser mayor a 0 y menor o igual a 100.",
    ]);
    expect(messages({ ...base, orderNum: "0" })).toEqual(["El orden debe ser un entero desde 1."]);
  });

  test("defaults the order to the next free position", () => {
    expect(nextCriterionOrder([])).toBe(1);
    expect(nextCriterionOrder(rows)).toBe(3);
    expect(emptyCriterionForm(3).orderNum).toBe("3");
  });

  test("loads an existing criterion into form values", () => {
    expect(criterionToFormValues(rows[1]!)).toEqual({
      name: "Formativo",
      weight: "20.5",
      description: "Tareas",
      orderNum: "2",
    });
  });
});

describe("totalWithCriterion", () => {
  test("adds the typed weight to the others, exact to two decimals", () => {
    expect(totalWithCriterion(rows, null, "59.5")).toBe(100);
    expect(totalWithCriterion(rows, null, "0.1")).toBe(40.6);
  });

  test("leaves out the criterion being edited", () => {
    expect(totalWithCriterion(rows, "b", "80")).toBe(100);
  });

  test("ignores a weight that is not a number yet", () => {
    expect(totalWithCriterion(rows, null, "")).toBe(40.5);
    expect(totalWithCriterion(rows, null, "abc")).toBe(40.5);
  });
});

describe("criterionUpdatedMessage", () => {
  test("mentions recalculated finals only when there are some", () => {
    expect(criterionUpdatedMessage(0)).toBe("Criterio actualizado");
    expect(criterionUpdatedMessage(12)).toBe(
      "Criterio actualizado. Se recalcularon 12 notas finales.",
    );
  });
});
