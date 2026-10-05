import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { Input } from "@base-template/ui/components/input";
import {
  CircleAlert,
  ClipboardList,
  Eye,
  FileDown,
  Handshake,
  MessageSquareText,
  Pencil,
  ThumbsUp,
  TriangleAlert,
  BellRing,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionButton } from "../../-components/confirm-action";
import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { CreateButton, EntityList } from "../../-components/entity-list";
import { FilterSelect } from "../../-components/filter-select";
import { IconLink } from "../../-components/icon-link";
import { NotificationBadge, ObservationTypeBadge } from "../../-components/observation-parts";
import { ScopedPage } from "../../-components/scoped-page";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { StudentLink } from "../../-components/student-link";
import type { TableColumn } from "../../-components/simple-table";
import { formatDate } from "../../-lib/format";
import { truncate } from "../../-lib/list";
import {
  OBSERVATION_LABEL,
  OBSERVATION_TYPES,
  countObservations,
  isPending,
  useObservationAccess,
} from "../../-lib/observations";
import { useSchool } from "../../-lib/use-school";
import {
  markObservationNotified,
  mockAction,
  mockInfo,
  observationStore,
  useMockCollection,
} from "../../-mock";
import type { Institution, Observation } from "../../-mock/types";

/** OBS-01: observations list with KPIs, filters, mark-as-notified and guarded delete. */
export function ObservationsScreen() {
  return (
    <ScopedPage
      screenId="OBS-01"
      title="Observaciones de Comportamiento"
      description="Gestión y seguimiento de observaciones estudiantiles"
      target="Observaciones"
      banner={false}
      actions={<CreateButton screenId="OBS-03" label="Nueva Observación" canCreate />}
    >
      {(institution) => <ObservationsView institution={institution} />}
    </ScopedPage>
  );
}

function ObservationsView({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const access = useObservationAccess(school);
  const all = useMockCollection(observationStore);
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const scoped = all.filter((row) => access.canSeeStudent(row.studentId));
  const counts = countObservations(scoped);
  const rows = scoped
    .filter(
      (row) =>
        (!type || row.type === type) &&
        (!category || row.category === category) &&
        (!author || String(row.authorId) === author) &&
        (!from || row.date.slice(0, 10) >= from) &&
        (!to || row.date.slice(0, 10) <= to),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));

  const categories = [...new Set(scoped.flatMap((row) => (row.category ? [row.category] : [])))];
  const authors = [...new Set(scoped.map((row) => row.authorId))];
  const hasFilters = Boolean(type || category || author || from || to);
  const reset = () => {
    setType("");
    setCategory("");
    setAuthor("");
    setFrom("");
    setTo("");
  };

  const columns: TableColumn<Observation>[] = [
    {
      key: "date",
      header: "Fecha",
      sortValue: (row) => row.date,
      cell: (row) => <span className="tabular-nums">{formatDate(row.date)}</span>,
    },
    {
      key: "student",
      header: "Estudiante",
      sortValue: (row) => school.studentName(row.studentId),
      cell: (row) => (
        <StudentLink screenId="OBS-05" studentId={row.studentId}>
          {school.studentName(row.studentId)}
        </StudentLink>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      sortValue: (row) => row.type,
      cell: (row) => <ObservationTypeBadge type={row.type} />,
    },
    {
      key: "category",
      header: "Categoría",
      sortValue: (row) => row.category,
      cell: (row) => row.category ?? <span className="text-muted-foreground">-</span>,
    },
    {
      key: "description",
      header: "Descripción",
      className: "max-w-72",
      cell: (row) => <span title={row.description}>{truncate(row.description, 100)}</span>,
    },
    {
      key: "author",
      header: "Autor",
      sortValue: (row) => school.userName(row.authorId),
      cell: (row) => school.userName(row.authorId) ?? "-",
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) =>
        isPending(row) ? (
          <ConfirmActionButton
            size="xs"
            title="¿Marcar esta observación como notificada?"
            description="Se registrará que los acudientes ya fueron informados."
            confirmLabel="Marcar como notificada"
            onConfirm={() => {
              markObservationNotified(row.id);
              mockAction("Observación marcada como notificada");
            }}
          >
            <BellRing data-icon="inline-start" />
            Marcar como notificada
          </ConfirmActionButton>
        ) : (
          <NotificationBadge observation={row} />
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-28",
      cell: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconLink screenId="OBS-02" search={{ id: String(row.id) }} label="Ver detalle">
            <Eye />
          </IconLink>
          {access.canEdit(row) ? (
            <IconLink screenId="OBS-03" search={{ id: String(row.id) }} label="Editar observación">
              <Pencil />
            </IconLink>
          ) : null}
          {access.canDelete ? (
            <ConfirmDeleteButton
              label="Eliminar observación"
              title="¿Eliminar esta observación?"
              description="Esta acción no se puede deshacer."
              onConfirm={() => {
                observationStore.remove(row.id);
                mockAction("Observación eliminada");
              }}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <StatGrid columns={5}>
        <StatTile label="Positivas" value={counts.positiva} icon={ThumbsUp} tone="success" />
        <StatTile
          label="Negativas"
          value={counts.negativa}
          icon={TriangleAlert}
          tone="destructive"
        />
        <StatTile label="Seguimiento" value={counts.seguimiento} icon={ClipboardList} tone="info" />
        <StatTile label="Convivencia" value={counts.convivencia} icon={Handshake} tone="warning" />
        <StatTile
          label="Notificadas"
          value={counts.notified}
          icon={MessageSquareText}
          hint={`${counts.pending} pendientes`}
        />
      </StatGrid>

      <EntityList
        title="Lista de Observaciones"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{rows.length} observaciones</Badge>
            {access.role !== "teacher" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => mockInfo("Exportar CSV", "La descarga no existe en el prototipo.")}
              >
                <FileDown data-icon="inline-start" />
                Exportar CSV
              </Button>
            ) : null}
          </div>
        }
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        searchText={(row) => [
          school.studentName(row.studentId),
          row.description,
          row.category,
          school.userName(row.authorId),
        ]}
        searchPlaceholder="Buscar por estudiante o descripción"
        emptyIcon={<CircleAlert />}
        emptyTitle="No hay observaciones"
        emptyDescription={
          hasFilters
            ? "No se encontraron observaciones con los filtros aplicados."
            : "Aún no se han registrado observaciones."
        }
        create={{ screenId: "OBS-03", label: "Crear primera observación" }}
        filters={
          <>
            <FilterSelect
              label="Filtrar por tipo"
              value={type}
              onValueChange={setType}
              options={OBSERVATION_TYPES.map((value) => ({
                value,
                label: OBSERVATION_LABEL[value],
              }))}
              allLabel="Todos los tipos"
            />
            <FilterSelect
              label="Filtrar por categoría"
              value={category}
              onValueChange={setCategory}
              options={categories.map((value) => ({ value, label: value }))}
              allLabel="Todas las categorías"
            />
            <FilterSelect
              label="Filtrar por autor"
              value={author}
              onValueChange={setAuthor}
              options={authors.map((id) => ({
                value: String(id),
                label: school.userName(id) ?? `Usuario #${id}`,
              }))}
              allLabel="Todos los autores"
            />
            <Input
              type="date"
              aria-label="Desde"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-auto"
            />
            <Input
              type="date"
              aria-label="Hasta"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-auto"
            />
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                Limpiar
              </Button>
            ) : null}
          </>
        }
      />
    </>
  );
}
