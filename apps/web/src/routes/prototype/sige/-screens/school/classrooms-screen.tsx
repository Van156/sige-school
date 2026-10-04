import { DoorOpen, FlaskConical, School } from "lucide-react";
import { useState } from "react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { reportDelete } from "../../-lib/delete-report";
import {
  CLASSROOM_TYPE_LABEL,
  CLASSROOM_TYPE_TONE,
  campusOptions,
} from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { deleteClassroom } from "../../-mock";
import type { Classroom, Institution } from "../../-mock/types";

/** SCH-07: classrooms (aulas, labs, auditorium, fields) of the institution's campuses. */
export function ClassroomsScreen() {
  return (
    <ScopedPage
      screenId="SCH-07"
      title="Gestión de Salones"
      description="Administración de salones y aulas por sede"
      target="Salones"
      actions={<CreateButton screenId="SCH-08" label="Nuevo Salón" canCreate />}
    >
      {(institution) => <ClassroomsView institution={institution} />}
    </ScopedPage>
  );
}

function ClassroomsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [campusId, setCampusId] = useState("");

  const rows = school.classrooms.filter((room) => !campusId || String(room.campusId) === campusId);
  const location = (room: Classroom) =>
    room.building ? `Edificio ${room.building}, Piso ${room.floor}` : `Piso ${room.floor}`;

  const columns: TableColumn<Classroom>[] = [
    {
      key: "name",
      header: "Nombre",
      sortValue: (room) => room.name,
      cell: (room) => <span className="font-medium">{room.name}</span>,
    },
    {
      key: "code",
      header: "Código",
      sortValue: (room) => room.code,
      cell: (room) => <span className="font-mono text-xs">{room.code ?? "-"}</span>,
    },
    {
      key: "campus",
      header: "Sede",
      sortValue: (room) => school.campusName(room.campusId),
      cell: (room) => school.campusName(room.campusId),
    },
    {
      key: "type",
      header: "Tipo",
      sortValue: (room) => room.classroomType,
      cell: (room) => (
        <ToneBadge tone={CLASSROOM_TYPE_TONE[room.classroomType]}>
          {CLASSROOM_TYPE_LABEL[room.classroomType]}
        </ToneBadge>
      ),
    },
    {
      key: "capacity",
      header: "Capacidad",
      align: "right",
      sortValue: (room) => room.capacity,
      cell: (room) => <span className="tabular-nums">{room.capacity} personas</span>,
    },
    {
      key: "location",
      header: "Ubicación",
      sortValue: location,
      cell: location,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (room) => (
        <RowActions
          editScreenId="SCH-08"
          id={room.id}
          entity="salón"
          name={room.name}
          onDelete={() => reportDelete(deleteClassroom(room.id), "Salón eliminado", room.name)}
        />
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile label="Total Salones" value={school.classrooms.length} icon={DoorOpen} />
        <StatTile
          label="Aulas"
          value={school.classrooms.filter((room) => room.classroomType === "aula").length}
          icon={School}
          tone="info"
        />
        <StatTile
          label="Laboratorios"
          value={school.classrooms.filter((room) => room.classroomType === "laboratorio").length}
          icon={FlaskConical}
          tone="warning"
        />
      </StatGrid>
      <EntityList
        title="Listado de Salones"
        columns={columns}
        rows={rows}
        getRowId={(room) => room.id}
        searchText={(room) => [
          room.name,
          room.code,
          school.campusName(room.campusId),
          CLASSROOM_TYPE_LABEL[room.classroomType],
          room.building,
        ]}
        searchPlaceholder="Buscar salón"
        emptyIcon={<DoorOpen />}
        emptyTitle="No hay salones registrados"
        emptyDescription="Registre los salones y aulas de la institución."
        create={{ screenId: "SCH-08", label: "Crear Salón" }}
        filters={
          <FilterSelect
            label="Filtrar por sede"
            value={campusId}
            onValueChange={setCampusId}
            options={campusOptions(school.campuses)}
            allLabel="Todas las sedes"
          />
        }
      />
    </>
  );
}
