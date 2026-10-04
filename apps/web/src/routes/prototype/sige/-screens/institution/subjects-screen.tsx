import { Badge } from "@base-template/ui/components/badge";
import { Library } from "lucide-react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { reportDelete } from "../../-lib/delete-report";
import { useCan } from "../../-lib/permissions";
import { deleteSubject, subjectStore, useMockCollection } from "../../-mock";
import type { Subject } from "../../-mock/types";

/** INS-13: subjects of the scoped institution (read-only for coordinators and teachers). */
export function SubjectsScreen() {
  const subjectList = useMockCollection(subjectStore);
  const canManage = useCan("INS-14");

  return (
    <ScopedPage
      screenId="INS-13"
      title="Asignaturas"
      description="Materias que se imparten en la institución"
      target="Asignaturas"
      actions={<CreateButton screenId="INS-14" label="Nueva Asignatura" canCreate={canManage} />}
    >
      {(institution) => {
        const rows = subjectList.filter((subject) => subject.institutionId === institution.id);
        const columns: TableColumn<Subject>[] = [
          {
            key: "code",
            header: "Código",
            sortValue: (subject) => subject.code ?? "",
            cell: (subject) =>
              subject.code ? <Badge variant="outline">{subject.code}</Badge> : "-",
          },
          {
            key: "name",
            header: "Nombre",
            sortValue: (subject) => subject.name,
            cell: (subject) => <span className="font-medium">{subject.name}</span>,
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Acciones</span>,
                  className: "w-24",
                  cell: (subject: Subject) => (
                    <RowActions
                      editScreenId="INS-14"
                      id={subject.id}
                      entity="asignatura"
                      name={subject.name}
                      onDelete={() =>
                        reportDelete(
                          deleteSubject(subject.id),
                          "Asignatura eliminada",
                          subject.name,
                        )
                      }
                    />
                  ),
                },
              ]
            : []),
        ];
        return (
          <EntityList
            title="Listado de Asignaturas"
            columns={columns}
            rows={rows}
            getRowId={(subject) => subject.id}
            searchText={(subject) => [subject.name, subject.code]}
            searchPlaceholder="Buscar asignatura"
            emptyIcon={<Library />}
            emptyTitle="No hay asignaturas"
            emptyDescription="Crea la primera asignatura de la institución."
            create={
              canManage ? { screenId: "INS-14", label: "Crear Primera Asignatura" } : undefined
            }
          />
        );
      }}
    </ScopedPage>
  );
}
