import { describe, expect, test } from "bun:test";

import {
  birthDateLabel,
  displayValue,
  genderLabel,
  isStudentProfileTab,
  studentProfileSearchDefaults,
  studentProfileSearchSchema,
} from "./student-profile";

describe("STU-02 tab in the URL", () => {
  test("defaults to info and drops unknown tabs", () => {
    expect(studentProfileSearchDefaults).toEqual({ tab: "info" });
    expect(studentProfileSearchSchema.parse({ tab: "horario" })).toEqual({ tab: "horario" });
    expect(studentProfileSearchSchema.parse({ tab: "notas" })).toEqual({ tab: "info" });
  });

  test("guards tab values from the tabs widget", () => {
    expect(isStudentProfileTab("acudientes")).toBe(true);
    expect(isStudentProfileTab("schedule")).toBe(false);
  });
});

describe("profile values", () => {
  test("empty values read N/A; numbers are kept", () => {
    expect(displayValue(null)).toBe("N/A");
    expect(displayValue("")).toBe("N/A");
    expect(displayValue(3)).toBe("3");
    expect(displayValue("Sanitas")).toBe("Sanitas");
  });

  test("gender and birth date labels", () => {
    expect(genderLabel("M")).toBe("Masculino");
    expect(genderLabel(null)).toBe("N/A");
    expect(birthDateLabel("2013-03-14")).toBe("14/03/2013");
    expect(birthDateLabel(null)).toBe("N/A");
  });
});
