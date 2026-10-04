import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { Building2, Eye, GraduationCap, Plus, ShieldCheck, University } from "lucide-react";
import { useState } from "react";

import { EmptyBlock } from "../../-components/empty-block";
import { FilterBar } from "../../-components/filter-bar";
import { ScreenLinkButton } from "../../-components/link-button";
import { SigePageHeader } from "../../-components/page-header";
import { RoleGate } from "../../-components/role-gate";
import { RowActions } from "../../-components/row-actions";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { reportDelete } from "../../-lib/delete-report";
import { matchesQuery } from "../../-lib/list";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import {
  campusStore,
  deleteInstitution,
  institutionStore,
  setActiveInstitution,
  summarizeInstitution,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { Institution, InstitutionSummary } from "../../-mock/types";

interface Row {
  institution: Institution;
  summary: InstitutionSummary;
}

/** INS-01: all institutions (root). Detail dialog, manage-campuses shortcut, edit and delete. */
export function InstitutionsListScreen() {
  const institutions = useMockCollection(institutionStore);
  const campusList = useMockCollection(campusStore);
  const userList = useMockCollection(userStore);
  const goTo = useGoToScreen();
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Row | null>(null);

  const allRows: Row[] = institutions.map((institution) => ({
    institution,
    summary: summarizeInstitution(institution.id, campusList, userList),
  }));
  const rows = allRows.filter(({ institution }) =>
    matchesQuery(
      query,
      institution.name,
      institution.nit,
      institution.municipality,
      institution.department,
    ),
  );
  const total = (pick: (summary: InstitutionSummary) => number) =>
    allRows.reduce((sum, row) => sum + pick(row.summary), 0);

  const manageCampuses = (institution: Institution) => {
    setActiveInstitution(institution.id);
    goTo("INS-07");
  };

  const columns: TableColumn<Row>[] = [
    {
      key: "logo",
      header: "Logo",
      cell: () => (
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Building2 className="size-4" />
        </span>
      ),
    },
    {
      key: "name",
      header: "Nombre",
      sortValue: (row) => row.institution.name,
      cell: ({ institution }) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{institution.name}</span>
          {institution.email ? (
            <span className="text-xs text-muted-foreground">{institution.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "nit",
      header: "NIT",
      sortValue: (row) => row.institution.nit ?? "",
      cell: ({ institution }) =>
        institution.nit ? <Badge variant="outline">{institution.nit}</Badge> : "-",
    },
    {
      key: "location",
      header: "Ubicación",
      sortValue: (row) => row.institution.municipality ?? "",
      cell: ({ institution }) =>
        institution.municipality
          ? `${institution.municipality}, ${institution.department ?? ""}`
          : "-",
    },
    {
      key: "year",
      header: "Año Lectivo",
      sortValue: (row) => row.institution.academicYear,
      cell: ({ institution }) => <Badge variant="secondary">{institution.academicYear}</Badge>,
    },
    {
      key: "campuses",
      header: "Sedes",
      align: "center",
      sortValue: (row) => row.summary.campuses,
      cell: ({ summary }) => <Badge variant="info">{summary.campuses}</Badge>,
    },
    {
      key: "students",
      header: "Estudiantes",
      align: "center",
      sortValue: (row) => row.summary.students,
      cell: ({ summary }) => <Badge variant="success">{summary.students}</Badge>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-44",
      cell: (row) => (
        <RowActions
          editScreenId="INS-02"
          id={row.institution.id}
          entity="institución"
          name={row.institution.name}
          before={
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ver datos completos de ${row.institution.name}`}
                title="Ver datos completos"
                onClick={() => setViewing(row)}
              >
                <Eye />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Gestionar sedes de ${row.institution.name}`}
                title="Gestionar sedes"
                onClick={() => manageCampuses(row.institution)}
              >
                <Building2 />
              </Button>
            </>
          }
          onDelete={() =>
            reportDelete(
              deleteInstitution(row.institution.id),
              "Institución eliminada",
              row.institution.name,
            )
          }
        />
      ),
    },
  ];

  return (
    <RoleGate screenId="INS-01">
      <div className="flex flex-col gap-4">
        <SigePageHeader
          title="Gestión de Instituciones"
          description="Administra todas las instituciones educativas del sistema"
          actions={
            <ScreenLinkButton screenId="INS-02" variant="default">
              <Plus data-icon="inline-start" />
              Nueva Institución
            </ScreenLinkButton>
          }
        />
        <StatGrid>
          <StatTile label="Total Instituciones" value={institutions.length} icon={University} />
          <StatTile
            label="Total Sedes"
            value={total((summary) => summary.campuses)}
            icon={Building2}
            tone="info"
          />
          <StatTile
            label="Total Estudiantes"
            value={total((summary) => summary.students)}
            icon={GraduationCap}
            tone="success"
          />
          <StatTile
            label="Total Admins"
            value={total((summary) => summary.admins)}
            icon={ShieldCheck}
            tone="warning"
          />
        </StatGrid>
        <SectionCard title="Listado de Instituciones">
          <FilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder="Buscar por nombre, NIT o ubicación"
          />
          <SimpleTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.institution.id}
            pageSize={10}
            empty={
              <EmptyBlock
                icon={<Building2 />}
                title={query ? "Sin resultados" : "No hay instituciones creadas"}
                description={
                  query
                    ? "Ninguna institución coincide con la búsqueda."
                    : "Comienza creando la primera institución educativa del sistema."
                }
                action={
                  query ? undefined : (
                    <ScreenLinkButton screenId="INS-02" variant="default">
                      Crear Primera Institución
                    </ScreenLinkButton>
                  )
                }
              />
            }
          />
        </SectionCard>
      </div>
      <InstitutionDetailDialog row={viewing} onClose={() => setViewing(null)} />
    </RoleGate>
  );
}

function InstitutionDetailDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const institution = row?.institution;
  const fields: Array<[string, string | undefined]> = [
    ["NIT", institution?.nit],
    ["Teléfono", institution?.phone],
    ["Email", institution?.email],
    ["Dirección", institution?.address],
    ["Resolución", institution?.resolution],
  ];
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{institution?.name ?? "Datos de la Institución"}</DialogTitle>
          <DialogDescription>
            Año {institution?.academicYear} ·{" "}
            {institution?.municipality
              ? `${institution.municipality}, ${institution.department ?? ""}`
              : "No especificada"}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value ?? "-"}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Sedes", row?.summary.campuses],
            ["Estudiantes", row?.summary.students],
            ["Año Lectivo", institution?.academicYear],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border px-2 py-2">
              <div className="text-lg font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {institution ? (
            <ScreenLinkButton
              screenId="INS-02"
              search={{ id: String(institution.id) }}
              variant="default"
            >
              Editar Institución
            </ScreenLinkButton>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
