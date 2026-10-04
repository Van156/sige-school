import { Badge } from "@base-template/ui/components/badge";
import { Clock, Coffee, Layers } from "lucide-react";
import { useState } from "react";

import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { RowActions } from "../../-components/row-actions";
import { ScopedPage } from "../../-components/scoped-page";
import type { TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge } from "../../-components/tone-badge";
import { reportDelete } from "../../-lib/delete-report";
import { SHIFT_OPTIONS, campusOptions } from "../../-lib/school-options";
import { useSchool } from "../../-lib/use-school";
import { deleteBlock } from "../../-mock";
import type { Institution, ScheduleBlock } from "../../-mock/types";

/** SCH-09: time blocks (class periods and breaks) per campus and shift. */
export function BlocksScreen() {
  return (
    <ScopedPage
      screenId="SCH-09"
      title="Bloques de Tiempo"
      description="Definición de bloques horarios para generación de horarios"
      target="Bloques"
      actions={<CreateButton screenId="SCH-10" label="Nuevo Bloque" canCreate />}
    >
      {(institution) => <BlocksView institution={institution} />}
    </ScopedPage>
  );
}

function BlocksView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const [campusId, setCampusId] = useState("");
  const [shift, setShift] = useState("");

  const rows = school.blocks
    .filter(
      (block) =>
        (!campusId || String(block.campusId) === campusId) && (!shift || block.shift === shift),
    )
    .sort(
      (a, b) =>
        a.campusId - b.campusId || a.shift.localeCompare(b.shift, "es") || a.orderNum - b.orderNum,
    );

  const columns: TableColumn<ScheduleBlock>[] = [
    {
      key: "order",
      header: "Orden",
      sortValue: (block) => block.orderNum,
      cell: (block) => <Badge variant="secondary">{block.orderNum}</Badge>,
    },
    {
      key: "name",
      header: "Nombre",
      sortValue: (block) => block.name,
      cell: (block) => (
        <span className={block.isBreak ? "font-medium text-warning-foreground" : "font-medium"}>
          {block.name}
        </span>
      ),
    },
    {
      key: "campus",
      header: "Sede",
      sortValue: (block) => school.campusName(block.campusId),
      cell: (block) => school.campusName(block.campusId),
    },
    {
      key: "shift",
      header: "Jornada",
      sortValue: (block) => block.shift,
      cell: (block) => <Badge variant="info">{block.shift}</Badge>,
    },
    {
      key: "start",
      header: "Hora Inicio",
      sortValue: (block) => block.startTime,
      cell: (block) => <span className="font-mono text-xs">{block.startTime}</span>,
    },
    {
      key: "end",
      header: "Hora Fin",
      sortValue: (block) => block.endTime,
      cell: (block) => <span className="font-mono text-xs">{block.endTime}</span>,
    },
    {
      key: "type",
      header: "Tipo",
      sortValue: (block) => Number(block.isBreak),
      cell: (block) => (
        <ToneBadge tone={block.isBreak ? "warning" : "success"}>
          {block.isBreak ? "Recreo" : "Clase"}
        </ToneBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (block) => (
        <RowActions
          editScreenId="SCH-10"
          id={block.id}
          entity="bloque"
          name={`${block.name} ${block.shift}`}
          onDelete={() => reportDelete(deleteBlock(block.id), "Bloque eliminado", block.name)}
        />
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={3}>
        <StatTile label="Total Bloques" value={school.blocks.length} icon={Layers} />
        <StatTile
          label="Bloques de Clase"
          value={school.blocks.filter((block) => !block.isBreak).length}
          icon={Clock}
          tone="success"
        />
        <StatTile
          label="Descansos"
          value={school.blocks.filter((block) => block.isBreak).length}
          icon={Coffee}
          tone="warning"
        />
      </StatGrid>
      <EntityList
        title="Bloques de Tiempo"
        columns={columns}
        rows={rows}
        getRowId={(block) => block.id}
        searchText={(block) => [block.name, school.campusName(block.campusId), block.shift]}
        searchPlaceholder="Buscar bloque"
        emptyIcon={<Layers />}
        emptyTitle="No hay bloques de tiempo definidos"
        emptyDescription="Defina los bloques horarios para cada sede."
        create={{ screenId: "SCH-10", label: "Crear Bloque" }}
        pageSize={12}
        filters={
          <>
            <FilterSelect
              label="Filtrar por sede"
              value={campusId}
              onValueChange={setCampusId}
              options={campusOptions(school.campuses)}
              allLabel="Todas las sedes"
            />
            <FilterSelect
              label="Filtrar por jornada"
              value={shift}
              onValueChange={setShift}
              options={SHIFT_OPTIONS}
              allLabel="Todas las jornadas"
            />
          </>
        }
      />
    </>
  );
}
