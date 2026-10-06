import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { UsersRound } from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { EmptyBlock } from "../../-components/empty-block";
import { SelectField } from "../../-components/form-fields";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { RELATIONSHIP_OPTIONS } from "../../-lib/school-options";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { mockAction, parentLinkStore } from "../../-mock";
import type { AcademicStudent, Institution } from "../../-mock/types";

/** STU-04: link guardian accounts to a student (`?id=`) and unlink them. */
export function AssignGuardiansScreen() {
  const id = useIdParam();

  return (
    <ScopedPage
      screenId="STU-04"
      title="Asignar Acudientes"
      description="Vincula las cuentas de acudientes con el estudiante"
      target="Estudiantes"
      banner={false}
      back={
        <>
          {id !== undefined ? (
            <BackButton screenId="STU-02" search={{ id: String(id) }} label="Volver al Perfil" />
          ) : null}
          <BackButton screenId="STU-01" label="Lista de Estudiantes" />
        </>
      }
    >
      {(institution) => <GuardiansLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function GuardiansLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const student = id === undefined ? undefined : school.students.find((entry) => entry.id === id);
  return student ? (
    <Guardians student={student} school={school} />
  ) : (
    <NotFoundBlock entity="Estudiante" backScreenId="STU-01" />
  );
}

function Guardians({ student, school }: { student: AcademicStudent; school: School }) {
  const user = school.userOfStudent(student);
  const links = school.parentLinks.filter((link) => link.studentId === student.id);
  const linked = new Set(links.map((link) => link.parentId));
  const available = school.parents.filter((parent) => !linked.has(parent.id));

  const [parentId, setParentId] = useState("");
  const [relationship, setRelationship] = useState("Acudiente");
  const [attempted, setAttempted] = useState(false);

  const assign = () => {
    setAttempted(true);
    if (!parentId) return;
    parentLinkStore.add({ parentId: Number(parentId), studentId: student.id, relationship });
    mockAction("Acudiente asignado", school.userName(Number(parentId)));
    setParentId("");
    setRelationship("Acudiente");
    setAttempted(false);
  };

  const course = school.gradeName(student.gradeId) ?? "Sin grado";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5">
        <span className="text-base font-semibold">{school.userName(student.userId)}</span>
        <span className="text-[13px] text-muted-foreground">
          {user ? `${user.documentType} ${user.documentNumber}` : ""} | {course} |{" "}
          {school.campusName(student.campusId)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Asignar Nuevo Acudiente">
          {available.length === 0 ? (
            <div className="flex flex-col items-start gap-2 text-[13px] text-muted-foreground">
              <p>No hay acudientes creados en la institución.</p>
              <ScreenLinkButton screenId="USR-02" size="sm" search={{ rol: "parent" }}>
                Crear acudiente primero
              </ScreenLinkButton>
            </div>
          ) : (
            <>
              <SelectField
                id="parentId"
                label="Seleccionar Acudiente"
                required
                placeholder="-- Seleccione un acudiente --"
                options={available.map((parent) => ({
                  value: String(parent.id),
                  label: `${parent.firstName} ${parent.lastName} (${parent.username}) - ${parent.documentNumber}`,
                }))}
                value={parentId}
                onValueChange={setParentId}
                error={attempted && !parentId ? "Selecciona un acudiente." : undefined}
              />
              <SelectField
                id="relationship"
                label="Parentesco / Relación"
                options={RELATIONSHIP_OPTIONS}
                value={relationship}
                onValueChange={setRelationship}
              />
              <div>
                <Button onClick={assign}>
                  <UsersRound data-icon="inline-start" />
                  Asignar Acudiente
                </Button>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Acudientes Asignados"
          action={<Badge variant="secondary">{links.length}</Badge>}
        >
          {links.length === 0 ? (
            <EmptyBlock title="No hay acudientes asignados a este estudiante" />
          ) : (
            <ul className="flex flex-col gap-2">
              {links.map((link) => {
                const parent = school.userById.get(link.parentId);
                const name = school.userName(link.parentId) ?? "Acudiente";
                return (
                  <li
                    key={link.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{name}</span>
                        <Badge variant="info">{link.relationship}</Badge>
                      </div>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {parent?.email ?? "Sin correo"} | {parent?.phone ?? "Sin teléfono"}
                      </span>
                    </div>
                    <ConfirmDeleteButton
                      label={`Quitar acudiente ${name}`}
                      title="¿Eliminar este acudiente?"
                      description={`${name} dejará de estar vinculado a este estudiante.`}
                      onConfirm={() => {
                        parentLinkStore.remove(link.id);
                        mockAction("Acudiente desvinculado", name);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
