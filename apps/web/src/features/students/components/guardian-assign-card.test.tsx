import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import AssignedGuardiansCard from "./assigned-guardians-card";
import GuardianAssignCard from "./guardian-assign-card";

const candidates = [
  { personId: "p1", name: "Patricia Gómez", username: "pgomez", document: "52123456" },
];

const renderAssign = (props: Partial<Parameters<typeof GuardianAssignCard>[0]> = {}) =>
  renderToStaticMarkup(
    <GuardianAssignCard
      candidates={candidates}
      status="ready"
      term=""
      onSearchChange={() => {}}
      onSubmit={async () => {}}
      {...props}
    />,
  );

describe("GuardianAssignCard", () => {
  test("offers the search and the relationship with Acudiente selected", () => {
    const html = renderAssign();
    expect(html).toContain("Seleccionar Acudiente");
    expect(html).toContain("-- Seleccione un acudiente --");
    expect(html).toContain('value="Acudiente" selected=""');
    expect(html).toContain("Asignar Acudiente");
  });

  test("without guardian accounts asks the administrator unless the caller can create one", () => {
    const asks = renderAssign({ candidates: [] });
    expect(asks).toContain("No hay acudientes creados en la institución.");
    expect(asks).toContain("Pida al administrador que cree la cuenta del acudiente.");
    expect(asks).not.toContain("<form");

    const creates = renderAssign({ candidates: [], createGuardian: <a href="/x">Crear</a> });
    expect(creates).toContain("Crear</a>");
    expect(creates).not.toContain("Pida al administrador");
  });

  test("an empty typed search keeps the form (no 'no guardians created')", () => {
    const html = renderAssign({ candidates: [], term: "zz" });
    expect(html).not.toContain("No hay acudientes creados");
    expect(html).toContain("<form");
  });

  test("shows the server's refusal", () => {
    expect(renderAssign({ error: "El usuario seleccionado no es un acudiente." })).toContain(
      "El usuario seleccionado no es un acudiente.",
    );
  });
});

describe("AssignedGuardiansCard", () => {
  test("lists the links with an accessible remove button", () => {
    const html = renderToStaticMarkup(
      <AssignedGuardiansCard
        onUnlink={() => {}}
        guardians={[
          {
            guardianPersonId: "p1",
            name: "Patricia Gómez",
            username: "pgomez",
            relationship: "Madre",
            email: null,
            phone: "300",
          },
        ]}
      />,
    );
    expect(html).toContain("Madre");
    expect(html).toContain("Sin correo | 300");
    expect(html).toContain('aria-label="Quitar acudiente Patricia Gómez"');
  });

  test("says when nothing is linked", () => {
    const html = renderToStaticMarkup(<AssignedGuardiansCard onUnlink={() => {}} guardians={[]} />);
    expect(html).toContain("No hay acudientes asignados a este estudiante");
  });
});
