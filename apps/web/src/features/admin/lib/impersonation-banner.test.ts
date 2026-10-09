import { describe, expect, test } from "bun:test";

import {
  impersonationBannerMessage,
  institutionQueryKeyFor,
  shouldShowImpersonationBanner,
} from "./impersonation-banner";

describe("shouldShowImpersonationBanner (R6.4)", () => {
  test("no impersonatedBy: hidden", () => {
    expect(shouldShowImpersonationBanner(null)).toBe(false);
    expect(shouldShowImpersonationBanner(undefined)).toBe(false);
  });

  test("an impersonatedBy user id: shown", () => {
    expect(shouldShowImpersonationBanner("superadmin-user-id")).toBe(true);
  });
});

describe("impersonationBannerMessage", () => {
  test("names the institution being managed", () => {
    expect(impersonationBannerMessage({ institutionName: "Colegio Sol", userName: "Marta" })).toBe(
      "Vista Root: estás gestionando Colegio Sol.",
    );
  });

  test("falls back to the impersonated account", () => {
    expect(impersonationBannerMessage({ userName: "Marta", userEmail: "m@sol.co" })).toBe(
      "Vista Root: estás gestionando la sesión de Marta (m@sol.co).",
    );
    expect(impersonationBannerMessage({ userEmail: "m@sol.co" })).toBe(
      "Vista Root: estás gestionando la sesión de (m@sol.co).",
    );
  });

  test("still reads when nothing is known", () => {
    expect(impersonationBannerMessage({})).toBe("Vista Root: estás gestionando otra sesión.");
  });
});

describe("institutionQueryKeyFor", () => {
  const base = ["institution", "get"] as const;

  test("keeps the base key as a prefix so invalidating it still reaches the entry", () => {
    expect(institutionQueryKeyFor(base, "org-1").slice(0, 2)).toEqual(["institution", "get"]);
  });

  test("differs per active organization", () => {
    expect(institutionQueryKeyFor(base, "org-1")).not.toEqual(
      institutionQueryKeyFor(base, "org-2"),
    );
  });

  test("treats a missing organization as null", () => {
    expect(institutionQueryKeyFor(base, undefined)).toEqual(institutionQueryKeyFor(base, null));
  });
});
