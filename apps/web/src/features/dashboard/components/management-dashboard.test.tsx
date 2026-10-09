import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ManagementDashboard from "./management-dashboard";

describe("ManagementDashboard", () => {
  const html = renderToStaticMarkup(
    <ManagementDashboard
      institutionName="Colegio Sol"
      impersonating={false}
      quickActions={[]}
      systemLinks={[]}
    />,
  );

  test("renders the DASH-02 header, KPI labels and blocks", () => {
    for (const text of [
      "Dashboard Administrador",
      "Gestión integral de tu institución educativa",
      "Tu Institución",
      "Estudiantes",
      "Profesores",
      "Grados",
      "Asignaturas",
      "Acciones Rápidas",
      "Configuración del Sistema",
      "Promedio por grupo",
      "Niveles de desempeño",
    ]) {
      expect(html).toContain(text);
    }
  });

  test("shows empty states instead of numbers or dead links", () => {
    expect(html).toContain("Sin acciones disponibles");
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/>\d+</);
  });

  test("labels the banner badge Vista Root while impersonating", () => {
    const root = renderToStaticMarkup(
      <ManagementDashboard impersonating quickActions={[]} systemLinks={[]} />,
    );
    expect(root).toContain("Vista Root");
    expect(root).not.toContain("Tu Institución");
  });
});
