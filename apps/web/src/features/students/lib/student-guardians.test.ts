import { describe, expect, test } from "bun:test";

import {
  CANDIDATES_SEARCH_FAILED_NOTICE,
  CANDIDATES_UNAVAILABLE_NOTICE,
  GUARDIAN_LINK_DEFAULTS,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  candidateItems,
  candidateLabel,
  candidatesNotice,
  candidatesStatus,
  guardianContactLine,
  guardianLinkValidator,
  hasNoCandidates,
  toGuardianLinkInput,
} from "./student-guardians";

const patricia = {
  personId: "p1",
  name: "Patricia Gómez",
  username: "pgomez",
  document: "52123456",
};

async function issues(values: { guardianPersonId: string; relationship: string }) {
  const result = await guardianLinkValidator["~standard"].validate(values);
  return "issues" in result && result.issues ? result.issues.map((issue) => issue.message) : [];
}

describe("guardian link form", () => {
  test("offers the seven relationships, defaulting to Acudiente", () => {
    expect(GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => option.value)).toEqual([
      "Acudiente",
      "Padre",
      "Madre",
      "Tío/a",
      "Abuelo/a",
      "Hermano/a",
      "Otro",
    ]);
    expect(GUARDIAN_LINK_DEFAULTS).toEqual({ guardianPersonId: "", relationship: "Acudiente" });
  });

  test("requires a guardian and a relationship with the spec messages", async () => {
    expect(await issues({ guardianPersonId: "", relationship: "Padre" })).toEqual([
      "Selecciona un acudiente.",
    ]);
    expect(await issues({ guardianPersonId: "p1", relationship: "" })).toEqual([
      "Debes seleccionar un parentesco.",
    ]);
    expect(await issues({ guardianPersonId: "p1", relationship: "Madre" })).toEqual([]);
  });

  test("builds the link input for the student", () => {
    expect(toGuardianLinkInput("s1", { guardianPersonId: "p1", relationship: "Madre" })).toEqual({
      studentId: "s1",
      guardianPersonId: "p1",
      relationship: "Madre",
    });
  });
});

describe("candidates", () => {
  test("label is name, username and document", () => {
    expect(candidateLabel(patricia)).toBe("Patricia Gómez (pgomez) - 52123456");
  });

  test("keeps the picked guardian when a later search omits it", () => {
    const picked = { value: "p9", label: "Luis Pérez (lperez) - 1" };
    expect(candidateItems([patricia], picked, "p9").map((item) => item.value)).toEqual([
      "p9",
      "p1",
    ]);
    expect(candidateItems([patricia], { value: "p1", label: "x" }, "p1")).toHaveLength(1);
    expect(candidateItems([patricia], undefined, "")).toHaveLength(1);
  });

  test("drops the picked guardian once the form no longer selects it (after a reset)", () => {
    const picked = { value: "p9", label: "Luis Pérez (lperez) - 1" };
    expect(candidateItems([patricia], picked, "").map((item) => item.value)).toEqual(["p1"]);
  });

  test("status separates the first load, a search and failures", () => {
    const query = { isPending: false, isFetching: false, isError: false };
    expect(candidatesStatus({ ...query, isPending: true, isFetching: true }, "")).toBe("loading");
    expect(candidatesStatus({ ...query, isFetching: true }, "pat")).toBe("searching");
    expect(candidatesStatus(query, "")).toBe("ready");
    expect(candidatesStatus({ ...query, isError: true }, "")).toBe("unavailable");
    expect(candidatesStatus({ ...query, isError: true }, "pat")).toBe("search-failed");
    expect(candidatesStatus({ ...query, isError: true, isFetching: true }, "pat")).toBe(
      "searching",
    );
  });

  test("notices only for failures", () => {
    expect(candidatesNotice("unavailable")).toBe(CANDIDATES_UNAVAILABLE_NOTICE);
    expect(candidatesNotice("search-failed")).toBe(CANDIDATES_SEARCH_FAILED_NOTICE);
    expect(candidatesNotice("ready")).toBeUndefined();
  });

  test("'no guardians created' only for an empty unfiltered list", () => {
    expect(hasNoCandidates("ready", "", [])).toBe(true);
    expect(hasNoCandidates("ready", "pat", [])).toBe(false);
    expect(hasNoCandidates("loading", "", [])).toBe(false);
    expect(hasNoCandidates("ready", "", [patricia])).toBe(false);
  });
});

describe("guardianContactLine", () => {
  test("shows email and phone, with fallbacks", () => {
    expect(guardianContactLine({ email: "p@x.co", phone: "300" })).toBe("p@x.co | 300");
    expect(guardianContactLine({ email: null, phone: null })).toBe("Sin correo | Sin teléfono");
  });
});
