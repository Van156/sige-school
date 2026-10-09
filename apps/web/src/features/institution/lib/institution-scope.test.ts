import { describe, expect, test } from "bun:test";

import {
  INSTITUTION_SELECTOR_PATH,
  decideInstitutionScope,
  formatInstitutionBannerLine,
  formatInstitutionLocation,
  institutionBannerBadge,
  selectInstitutionMessage,
} from "./institution-scope";

describe("decideInstitutionScope", () => {
  test("waits while the session is loading, whatever the other inputs say", () => {
    expect(
      decideInstitutionScope({
        isPending: true,
        isSuperadmin: false,
        activeOrganizationId: undefined,
      }),
    ).toBe("pending");
    expect(
      decideInstitutionScope({ isPending: true, isSuperadmin: true, activeOrganizationId: null }),
    ).toBe("pending");
  });

  test("sends a superadmin without an active organization to the selector", () => {
    expect(decideInstitutionScope({ isSuperadmin: true, activeOrganizationId: null })).toBe(
      "select-institution",
    );
    expect(decideInstitutionScope({ isSuperadmin: true, activeOrganizationId: undefined })).toBe(
      "select-institution",
    );
  });

  test("allows a superadmin inside an institution and every non-superadmin", () => {
    expect(decideInstitutionScope({ isSuperadmin: true, activeOrganizationId: "org-1" })).toBe(
      "allow",
    );
    expect(decideInstitutionScope({ isSuperadmin: false, activeOrganizationId: null })).toBe(
      "allow",
    );
  });
});

describe("institutionBannerBadge", () => {
  test("distinguishes the impersonating root from the institution's own staff", () => {
    expect(institutionBannerBadge("root-user")).toBe("Vista Root");
    expect(institutionBannerBadge(null)).toBe("Tu Institución");
    expect(institutionBannerBadge(undefined)).toBe("Tu Institución");
  });
});

describe("selectInstitutionMessage", () => {
  test("interpolates the page name", () => {
    expect(selectInstitutionMessage("sus niveles académicos")).toBe(
      "Necesitas seleccionar una institución para ver sus niveles académicos.",
    );
  });
});

describe("formatInstitutionLocation", () => {
  test("joins municipality and department", () => {
    expect(formatInstitutionLocation("Medellín", "Antioquia")).toBe("Medellín, Antioquia");
  });

  test("keeps a lone part and falls back when both are blank", () => {
    expect(formatInstitutionLocation("Medellín", null)).toBe("Medellín");
    expect(formatInstitutionLocation(" ", undefined)).toBe("Ubicación no especificada");
  });
});

describe("INSTITUTION_SELECTOR_PATH", () => {
  test("is the INS-03 route", () => {
    expect(INSTITUTION_SELECTOR_PATH).toBe("/admin/instituciones/seleccionar");
  });
});

describe("formatInstitutionBannerLine", () => {
  test("appends the NIT to the location", () => {
    expect(formatInstitutionBannerLine("Medellín", "Antioquia", "900.123.456-7")).toBe(
      "Medellín, Antioquia | NIT: 900.123.456-7",
    );
  });

  test("is just the location without a NIT", () => {
    expect(formatInstitutionBannerLine("Medellín", "Antioquia", null)).toBe("Medellín, Antioquia");
    expect(formatInstitutionBannerLine(null, null, "  ")).toBe("Ubicación no especificada");
  });
});
