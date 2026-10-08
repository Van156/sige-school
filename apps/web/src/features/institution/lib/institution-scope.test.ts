import { describe, expect, test } from "bun:test";

import {
  decideInstitutionScope,
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
