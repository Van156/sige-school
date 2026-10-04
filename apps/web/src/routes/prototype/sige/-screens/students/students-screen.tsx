import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Eye,
  FileSpreadsheet,
  GraduationCap,
  MessageSquarePlus,
  Pencil,
  UserRoundX,
} from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { IconLink } from "../../-components/icon-link";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { reportDelete } from "../../-lib/delete-report";
import { useCan } from "../../-lib/permissions";
import {
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
  campusOptions,
  gradeOptions,
} from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { deleteStudent } from "../../-mock";
import type { AcademicStudent, Institution, User } from "../../-mock/types";

const STATUS_FILTER_OPTIONS = [
  { value: "activo", label: "Activos" },
  { value: "retirado", label: "Retirados" },
  { value: "graduado", label: "Graduados" },
  { value: "todos", label: "Todos" },
] as const;

/** STU-01: students of the institution plus the users still missing an academic profile. */
export function StudentsScreen() {
  const canEdit = useCan("STU-03");

  return (
    <ScopedPage
      screenId="STU-01"
      title="Gestión de Estudiantes"
      description="Administra los estudiantes de la institución"
      target="Estudiantes"
      actions={
        canEdit ? (
          <>
            <ScreenLinkButton screenId="STU-05">
              <FileSpreadsheet data-icon="inline-start" />
              Cargar Excel
            </ScreenLinkButton>
            <CreateButton screenId="STU-03" label="Nuevo Estudiante" canCreate />
          </>
        ) : undefined
      }
    >
      {(institution) => <StudentsView institution={institution} canEdit={canEdit} />}
    </ScopedPage>
  );
}

function StudentsView({ institution, canEdit }: { institution: Institution; canEdit: boolean }) {
  const school = useSchool(institution.id);
  const [campusId, setCampusId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [status, setStatus] = useState("activo");

  const reset = () => {
    setCampusId("");
    setGradeId("");
    setStatus("activo");
  };

  const rows = school.students.filter(
    (student) =>
      (!campusId || String(student.campusId) === campusId) &&
      (!gradeId || String(student.gradeId) === gradeId) &&
      (status === "todos" || student.status === status),
  );
  const gradesOfCampus = school.grades.filter(
    (grade) => !campusId || String(grade.campusId) === campusId,
  );

  const profiled = new Set(school.students.map((student) => student.userId));
  const incomplete = school.users.filter(
    (user) =>
      user.role === "student" && user.institutionId === institution.id && !profiled.has(user.id),
  );

  const documentOf = (student: AcademicStudent) => {
    const user = school.userOfStudent(student);
    return user ? `${user.documentType} ${user.documentNumber}` : "";
  };

  const columns: TableColumn<AcademicStudent>[] = [
    {
      key: "student",
      header: "Estudiante",
      sortValue: (student) => school.userName(student.userId),
      cell: (student) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{school.userName(student.userId)}</span>
          {student.guardianName ? (
            <span className="truncate text-xs text-muted-foreground">
              Acudiente: {student.guardianName}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "document",
      header: "Documento",
      sortValue: documentOf,
      cell: (student) => <Badge variant="secondary">{documentOf(student)}</Badge>,
    },
    {
      key: "grade",
      header: "Grado",
      sortValue: (student) => school.gradeName(student.gradeId) ?? "",
      cell: (student) =>
        student.gradeId === undefined ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <Badge variant="outline">{school.gradeName(student.gradeId)}</Badge>
        ),
    },
    {
      key: "campus",
      header: "Sede",
      sortValue: (student) => school.campusName(student.campusId),
      cell: (student) => school.campusName(student.campusId),
    },
    {
      key: "status",
      header: "Estado",
      sortValue: (student) => student.status,
      cell: (student) => (
        <ToneBadge tone={STUDENT_STATUS_TONE[student.status]}>
          {STUDENT_STATUS_LABEL[student.status]}
        </ToneBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-36",
      cell: (student) => {
        const name = school.userName(student.userId) ?? "estudiante";
        return (
          <div className="flex items-center justify-end gap-0.5">
            <IconLink
              screenId="STU-02"
              search={{ id: String(student.id) }}
              label={`Ver perfil de ${name}`}
            >
              <Eye />
            </IconLink>
            {canEdit ? (
              <IconLink
                screenId="STU-03"
                search={{ id: String(student.id) }}
                label={`Editar a ${name}`}
              >
                <Pencil />
              </IconLink>
            ) : null}
            <IconLink
              screenId="OBS-04"
              search={{ student: String(student.id) }}
              label={`Registrar observación de ${name}`}
            >
              <MessageSquarePlus />
            </IconLink>
            {canEdit ? (
              <ConfirmDeleteButton
                label={`Eliminar a ${name}`}
                title="¿Eliminar este estudiante?"
                description="Esta acción no se puede deshacer."
                onConfirm={() =>
                  reportDelete(deleteStudent(student.id), "Estudiante eliminado", name)
                }
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <EntityList
        title="Lista de Estudiantes"
        action={<Badge variant="secondary">{rows.length} estudiantes</Badge>}
        columns={columns}
        rows={rows}
        getRowId={(student) => student.id}
        searchText={(student) => [
          school.userName(student.userId),
          documentOf(student),
          student.guardianName,
          school.gradeName(student.gradeId),
        ]}
        searchPlaceholder="Buscar por nombre, documento o acudiente"
        emptyIcon={<GraduationCap />}
        emptyTitle="No se encontraron estudiantes con perfil académico completo"
        emptyDescription="Intenta cambiar los filtros o crea un nuevo estudiante."
        create={canEdit ? { screenId: "STU-03", label: "Crear Estudiante" } : undefined}
        filters={
          <>
            <FilterSelect
              label="Filtrar por sede"
              value={campusId}
              onValueChange={(value) => {
                setCampusId(value);
                setGradeId("");
              }}
              options={campusOptions(school.campuses)}
              allLabel="Todas las sedes"
            />
            <FilterSelect
              label="Filtrar por grado"
              value={gradeId}
              onValueChange={setGradeId}
              options={gradeOptions(gradesOfCampus)}
              allLabel="Todos los grados"
            />
            <FilterSelect
              label="Filtrar por estado"
              value={status}
              onValueChange={setStatus}
              options={STATUS_FILTER_OPTIONS}
            />
            <Button variant="ghost" size="sm" onClick={reset}>
              Limpiar
            </Button>
          </>
        }
      />
      {canEdit && incomplete.length > 0 ? <IncompleteProfiles users={incomplete} /> : null}
    </>
  );
}

function IncompleteProfiles({ users }: { users: readonly User[] }) {
  const columns: TableColumn<User>[] = [
    {
      key: "student",
      header: "Estudiante",
      cell: (user) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {user.firstName} {user.lastName}
          </span>
          <span className="text-xs text-muted-foreground">Sin perfil académico</span>
        </div>
      ),
    },
    {
      key: "document",
      header: "Documento",
      cell: (user) => (
        <Badge variant="secondary">{`${user.documentType} ${user.documentNumber}`}</Badge>
      ),
    },
    {
      key: "username",
      header: "Username",
      cell: (user) => <span className="font-mono text-xs">{user.username}</span>,
    },
    { key: "email", header: "Email", cell: (user) => user.email ?? "-" },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-44",
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          <ScreenLinkButton screenId="STU-03" size="sm" search={{ user: String(user.id) }}>
            Completar
          </ScreenLinkButton>
          <IconLink
            screenId="USR-03"
            search={{ id: String(user.id) }}
            label={`Editar usuario ${user.username}`}
          >
            <Pencil />
          </IconLink>
        </div>
      ),
    },
  ];

  return (
    <SectionCard
      title="Perfiles Académicos Incompletos"
      description="Usuarios con rol estudiante que aún no tienen perfil académico."
      action={
        <Badge variant="warning">
          <UserRoundX />
          {users.length} pendientes
        </Badge>
      }
    >
      <SimpleTable columns={columns} rows={users} getRowId={(user) => user.id} />
    </SectionCard>
  );
}
