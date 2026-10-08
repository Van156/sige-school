import { describe, expect, test } from "bun:test";

import { impersonationBannerMessage, shouldShowImpersonationBanner } from "./impersonation-banner";

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
