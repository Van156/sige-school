import { describe, expect, test } from "bun:test";

import { subjectToFormValues, toSubjectInput } from "./subject-form";

describe("subject form", () => {
  test("blanks a null code for the form", () => {
    expect(subjectToFormValues({ id: "1", name: "Artes", code: null })).toEqual({
      name: "Artes",
      code: "",
    });
  });

  test("omits a blank code and trims the name", () => {
    expect(toSubjectInput({ name: "  Artes ", code: "  " })).toEqual({
      name: "Artes",
      code: undefined,
    });
    expect(toSubjectInput({ name: "Artes", code: "ART" })).toEqual({ name: "Artes", code: "ART" });
  });

  test("rejects a blank name with the spec message", () => {
    expect(() => toSubjectInput({ name: " ", code: "" })).toThrow(
      "El nombre de la asignatura es obligatorio.",
    );
  });
});
