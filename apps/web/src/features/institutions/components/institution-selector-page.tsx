import { buttonVariants } from "@base-template/ui/components/button";
import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Input } from "@base-template/ui/components/input";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, LayoutDashboard, List, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { orpc } from "@/app/orpc";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { useDebouncedCallback } from "@/shared/hooks/use-debounced-callback";

import { useManageInstitution } from "../hooks/use-manage-institution";
import { selectorTruncationNotice, toSelectorListInput } from "../lib/institution-list";
import InstitutionSelector from "./institution-selector";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * INS-03 `/admin/instituciones/seleccionar` (container, root only): pick the institution to work
 * in. "Seleccionar y Continuar" calls `institutionAdmin.manage`, starts the impersonation and
 * opens the dashboard of that institution.
 */
export default function InstitutionSelectorPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const applySearch = useDebouncedCallback(setSearch, SEARCH_DEBOUNCE_MS);
  const listQuery = useQuery({
    ...orpc.institutionAdmin.list.queryOptions({ input: toSelectorListInput(search) }),
    placeholderData: keepPreviousData,
  });
  const manage = useManageInstitution("/dashboard");
  const institutions = listQuery.data?.rows;
  const isSearching = search.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Seleccionar Institución"
        description="Como administrador del sistema, seleccione la institución donde desea trabajar"
        actions={
          <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Volver al Dashboard
          </Link>
        }
      />
      <Alert>
        <Building2 />
        <AlertDescription>
          <strong>Importante:</strong> Debe seleccionar una institución para gestionar sedes, grados
          y otros elementos. Esta selección determina el contexto de trabajo.
        </AlertDescription>
      </Alert>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Instituciones Disponibles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            type="search"
            aria-label="Buscar institución por nombre"
            placeholder="Buscar por nombre..."
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              applySearch(event.target.value);
            }}
          />
          {listQuery.isPending ? (
            <Loader />
          ) : listQuery.isError || institutions === undefined ? (
            <LoadError
              message="No se pudieron cargar las instituciones."
              onRetry={() => void listQuery.refetch()}
            />
          ) : institutions.length === 0 && isSearching ? (
            <EmptyState
              icon={<Building2 />}
              title="Sin resultados"
              description="Ninguna institución coincide con la búsqueda."
            />
          ) : institutions.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="No hay instituciones creadas"
              description="Comienza creando tu primera institución educativa del sistema."
              action={
                <Link to="/admin/instituciones/nueva" className={buttonVariants()}>
                  Crear Primera Institución
                </Link>
              }
            />
          ) : (
            <InstitutionSelector
              institutions={institutions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSubmit={() => selectedId && manage.manage(selectedId)}
              isSubmitting={manage.isPending}
              notice={selectorTruncationNotice(institutions.length, listQuery.data?.total ?? 0)}
            />
          )}
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <ShortcutCard to="/admin/instituciones" icon={<List />} label="Lista Completa" />
        <ShortcutCard to="/admin/instituciones/nueva" icon={<Plus />} label="Nueva Institución" />
        <ShortcutCard to="/dashboard" icon={<LayoutDashboard />} label="Dashboard Root" />
      </div>
    </div>
  );
}

function ShortcutCard({
  to,
  icon,
  label,
}: {
  to: "/admin/instituciones" | "/admin/instituciones/nueva" | "/dashboard";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className={buttonVariants({ variant: "outline" })}>
      {icon}
      {label}
    </Link>
  );
}
