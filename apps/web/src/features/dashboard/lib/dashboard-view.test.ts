import { describe, expect, test } from "bun:test";

import { resolveDashboardView } from "./dashboard-view";

describe("resolveDashboardView", () => {
  test("owner and admin land on the management dashboard", () => {
    expect(resolveDashboardView("owner", "Ana")).toEqual({ type: "management" });
    expect(resolveDashboardView("admin", "Ana")).toEqual({ type: "management" });
  });

  test("other kinds get a titled placeholder greeting the user", () => {
    expect(resolveDashboardView("teacher", "Luis")).toEqual({
      type: "placeholder",
      title: "Dashboard Profesor",
      description: "Bienvenido/a, Luis",
    });
    expect(resolveDashboardView("student", "Eva")).toMatchObject({ title: "Mi Dashboard" });
    expect(resolveDashboardView("parent", "Eva")).toMatchObject({ title: "Portal de Acudientes" });
    expect(resolveDashboardView("viewer", "Eva")).toMatchObject({
      title: "Dashboard de Consulta",
    });
    expect(resolveDashboardView("coordinator", "Eva")).toMatchObject({
      title: "Dashboard Coordinador",
    });
  });

  test("a user without a SIGE kind gets the root dashboard title", () => {
    expect(resolveDashboardView(null, "Root")).toMatchObject({
      title: "Panel de Administración General",
    });
  });
});
