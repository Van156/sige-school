import { describe, expect, test } from "bun:test";

import {
  EXAMPLE_BLOCKS,
  emptyTimeBlockForm,
  nextOrderNum,
  TIME_BLOCK_FIELD_BY_MESSAGE,
  TIME_BLOCK_FIELDS,
  timeBlockFormSchema,
  timeBlockToFormValues,
  toTimeBlockInput,
} from "./time-block-form";

const valid = { ...emptyTimeBlockForm(2), campusId: "c1", name: " Bloque 2 " };

function messages(values: Parameters<typeof timeBlockFormSchema.safeParse>[0]) {
  const result = timeBlockFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("toTimeBlockInput", () => {
  test("trims the name and parses the order", () => {
    expect(toTimeBlockInput(valid)).toEqual({
      campusId: "c1",
      name: "Bloque 2",
      shift: "Mañana",
      startTime: "07:00",
      endTime: "08:00",
      orderNum: 2,
      isBreak: false,
    });
  });

  test("keeps the break switch", () => {
    expect(toTimeBlockInput({ ...valid, isBreak: true }).isBreak).toBe(true);
  });
});

describe("timeBlockFormSchema messages", () => {
  test("reports the spec messages for required fields", () => {
    expect(messages({ ...emptyTimeBlockForm(), startTime: "", endTime: "" })).toEqual([
      "Debes seleccionar una sede.",
      "El nombre es obligatorio.",
      "La hora de inicio es obligatoria.",
      "La hora de fin es obligatoria.",
    ]);
  });

  test("the end must be after the start", () => {
    expect(messages({ ...valid, startTime: "08:00", endTime: "08:00" })).toEqual([
      "La hora de fin debe ser posterior a la de inicio.",
    ]);
    expect(messages({ ...valid, startTime: "09:00", endTime: "08:00" })).toEqual([
      "La hora de fin debe ser posterior a la de inicio.",
    ]);
  });

  test("the order is an integer of 1 or more", () => {
    for (const orderNum of ["", "0", "-1", "1.5", "abc"]) {
      expect(messages({ ...valid, orderNum })).toEqual(["El orden debe ser 1 o mayor."]);
    }
  });

  test("an unknown jornada asks for a selection", () => {
    expect(messages({ ...valid, shift: "" })).toEqual(["Debes seleccionar una jornada."]);
  });
});

describe("timeBlockToFormValues", () => {
  test("turns a row into form controls", () => {
    expect(
      timeBlockToFormValues({
        id: "b1",
        campusId: "c1",
        campusName: "Principal",
        name: "Recreo",
        shift: "Tarde",
        startTime: "09:00",
        endTime: "09:30",
        isBreak: true,
        orderNum: 3,
        academicYear: "2026",
        inUse: true,
      }),
    ).toEqual({
      campusId: "c1",
      name: "Recreo",
      shift: "Tarde",
      startTime: "09:00",
      endTime: "09:30",
      orderNum: "3",
      isBreak: true,
    });
  });
});

describe("nextOrderNum", () => {
  const blocks = [
    { campusId: "c1", shift: "Mañana", orderNum: 1 },
    { campusId: "c1", shift: "Mañana", orderNum: 4 },
    { campusId: "c1", shift: "Tarde", orderNum: 9 },
    { campusId: "c2", shift: "Mañana", orderNum: 7 },
  ] as const;

  test("is one past the highest order of the same campus and jornada", () => {
    expect(nextOrderNum(blocks, "c1", "Mañana")).toBe(5);
    expect(nextOrderNum(blocks, "c2", "Mañana")).toBe(8);
  });

  test("starts at 1 without blocks or without a campus", () => {
    expect(nextOrderNum(blocks, "c2", "Tarde")).toBe(1);
    expect(nextOrderNum(blocks, "", "Mañana")).toBe(1);
  });
});

describe("static data", () => {
  test("every mapped field is rendered by the form", () => {
    for (const field of Object.values(TIME_BLOCK_FIELD_BY_MESSAGE)) {
      expect(TIME_BLOCK_FIELDS as readonly string[]).toContain(field);
    }
  });

  test("the typical blocks are eight, in order, with two breaks", () => {
    expect(EXAMPLE_BLOCKS.map((block) => block.orderNum)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(EXAMPLE_BLOCKS.filter((block) => block.isBreak).map((block) => block.name)).toEqual([
      "Recreo",
      "Almuerzo",
    ]);
  });
});
