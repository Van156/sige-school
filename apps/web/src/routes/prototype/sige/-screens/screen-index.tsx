import { Badge } from "@base-template/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Link } from "@tanstack/react-router";
import { FlaskConical, LayoutList } from "lucide-react";
import { useState } from "react";

import { EmptyBlock } from "../-components/empty-block";
import { FilterBar } from "../-components/filter-bar";
import { ScreenLink } from "../-components/sige-link";
import { SigePageHeader } from "../-components/page-header";
import { SectionCard } from "../-components/section-card";
import { SimpleTable, type TableColumn } from "../-components/simple-table";
import { StatGrid, StatTile } from "../-components/stat-tile";
import { ToneBadge } from "../-components/tone-badge";
import { ROLES, ROLE_LABEL } from "../-lib/roles";
import {
  MODULE_LABEL,
  MODULE_ORDER,
  builtCount,
  screens,
  screensOfModule,
  type ScreenDef,
} from "../-screens";

type StatusFilter = "all" | "built" | "pending";

const columns: TableColumn<ScreenDef>[] = [
  {
    key: "id",
    header: "ID",
    cell: (screen) => (
      <Badge variant="outline" className="font-mono">
        {screen.id}
      </Badge>
    ),
  },
  {
    key: "title",
    header: "Pantalla",
    cell: (screen) => (
      <ScreenLink
        screenId={screen.id}
        className="font-medium underline-offset-4 hover:text-primary hover:underline"
      >
        {screen.title}
      </ScreenLink>
    ),
  },
  {
    key: "roles",
    header: "Roles",
    className: "whitespace-normal",
    cell: (screen) =>
      screen.roles.length === ROLES.length ? (
        <span className="text-muted-foreground">Todos</span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {ROLES.filter((role) => screen.roles.includes(role)).map((role) => (
            <Badge key={role} variant="secondary">
              {ROLE_LABEL[role]}
            </Badge>
          ))}
        </span>
      ),
  },
  {
    key: "status",
    header: "Estado",
    cell: (screen) =>
      screen.status === "built" ? (
        <ToneBadge tone="success">Construida</ToneBadge>
      ) : (
        <ToneBadge tone="outline">Pendiente</ToneBadge>
      ),
  },
];

/** `/prototype/sige`: every legacy screen grouped by module, with built/pending status. */
export function ScreenIndex() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const built = builtCount();
  const needle = query.trim().toLowerCase();

  const matches = (screen: ScreenDef) =>
    (status === "all" || screen.status === status) &&
    (needle === "" || `${screen.id} ${screen.title}`.toLowerCase().includes(needle));

  const visibleModules = MODULE_ORDER.map((module) => ({
    module,
    rows: screensOfModule(module).filter(matches),
    total: screensOfModule(module).length,
  })).filter((entry) => entry.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <SigePageHeader
        title="Pantallas del sistema"
        description="SIGE - Sistema Integral de Gestión Escolar, adaptado al sistema de diseño. Cambia de rol con el selector de prototipo del encabezado."
        actions={
          <Link
            to="/prototype"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <FlaskConical className="size-4" />
            Volver al Prototype Lab
          </Link>
        }
      />

      <StatGrid columns={3}>
        <StatTile label="Pantallas del inventario" value={screens.length} icon={LayoutList} />
        <StatTile label="Construidas" value={built} icon={LayoutList} tone="success" />
        <StatTile
          label="Pendientes"
          value={screens.length - built}
          icon={LayoutList}
          tone="warning"
        />
      </StatGrid>

      <FilterBar query={query} onQueryChange={setQuery} placeholder="Buscar por ID o título">
        <NativeSelect
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
        >
          <NativeSelectOption value="all">Todos los estados</NativeSelectOption>
          <NativeSelectOption value="built">Construidas</NativeSelectOption>
          <NativeSelectOption value="pending">Pendientes</NativeSelectOption>
        </NativeSelect>
      </FilterBar>

      {visibleModules.length === 0 ? (
        <EmptyBlock title="Sin resultados" description="Ninguna pantalla coincide con el filtro." />
      ) : (
        visibleModules.map(({ module, rows, total }) => (
          <SectionCard
            key={module}
            title={MODULE_LABEL[module]}
            description={`${module} · ${rows.length} de ${total} pantallas`}
          >
            <SimpleTable columns={columns} rows={rows} getRowId={(screen) => screen.id} />
          </SectionCard>
        ))
      )}
    </div>
  );
}
