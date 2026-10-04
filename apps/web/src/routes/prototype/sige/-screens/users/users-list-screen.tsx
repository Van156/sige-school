import { Badge } from "@base-template/ui/components/badge";
import { buttonVariants } from "@base-template/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { cn } from "@base-template/ui/lib/utils";
import {
  Activity,
  FileSpreadsheet,
  GraduationCap,
  Pencil,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { EmptyBlock } from "../../-components/empty-block";
import { FilterBar } from "../../-components/filter-bar";
import { InstitutionBanner } from "../../-components/institution-banner";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScreenPage } from "../../-components/scoped-page";
import { ScreenLink } from "../../-components/sige-link";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { RoleBadge, ToneBadge } from "../../-components/tone-badge";
import { UserCell } from "../../-components/user-cell";
import { reportDelete } from "../../-lib/delete-report";
import { matchesQuery } from "../../-lib/list";
import { ROLE_LABEL } from "../../-lib/roles";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useRole } from "../../-lib/use-role";
import { useRolParam } from "../../-lib/use-search-params";
import { assignableRoles, isRole } from "../../-lib/user-options";
import {
  currentUserFor,
  deleteUser,
  fullName,
  institutionStore,
  userStore,
  useMockCollection,
} from "../../-mock";
import type { Role, User } from "../../-mock/types";

const ROLE_PLURAL: Record<Role, string> = {
  root: "Usuarios Root",
  admin: "Administradores",
  coordinator: "Coordinadores",
  teacher: "Profesores",
  student: "Estudiantes",
  parent: "Acudientes",
  viewer: "Usuarios de Consulta",
};

/** USR-01: users of the system (root) or of the institution (admin), filtered by `?rol=`. */
export function UsersListScreen() {
  const role = useRole();
  const rolParam = useRolParam();
  const filterRole = rolParam && isRole(rolParam) ? rolParam : undefined;
  const userList = useMockCollection(userStore);
  const institutions = useMockCollection(institutionStore);
  const goTo = useGoToScreen();
  const [query, setQuery] = useState("");

  const isRoot = role === "root";
  const self = currentUserFor(role);
  // Admin only sees the users of their own institution; root sees everyone.
  const scoped = isRoot
    ? userList
    : userList.filter((user) => user.institutionId === self.institutionId);
  const rows = scoped.filter(
    (user) =>
      (!filterRole || user.role === filterRole) &&
      matchesQuery(query, user.firstName, user.lastName, user.email, user.username),
  );
  const count = (target: Role) => scoped.filter((user) => user.role === target).length;
  const institutionName = (user: User) =>
    institutions.find((institution) => institution.id === user.institutionId)?.name;
  const ownInstitution = institutions.find((institution) => institution.id === self.institutionId);

  const title = filterRole ? ROLE_PLURAL[filterRole] : "Gestión de Usuarios";
  const roleFilterOptions = assignableRoles("root").filter((option) => isRoot || option !== "root");

  const columns: TableColumn<User>[] = [
    {
      key: "user",
      header: "Usuario",
      sortValue: (user) => user.username,
      cell: (user) => <UserCell user={user} />,
    },
    {
      key: "name",
      header: "Nombre Completo",
      sortValue: (user) => fullName(user),
      cell: (user) => fullName(user),
    },
    {
      key: "role",
      header: "Rol",
      sortValue: (user) => user.role,
      cell: (user) => <RoleBadge role={user.role} />,
    },
    ...(isRoot
      ? [
          {
            key: "institution",
            header: "Institución",
            sortValue: (user: User) => institutionName(user) ?? "",
            cell: (user: User) => (
              <span className="block max-w-48 truncate">{institutionName(user) ?? "-"}</span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Estado",
      sortValue: (user) => Number(user.isActive),
      cell: (user) => (
        <ToneBadge tone={user.isActive ? "success" : "secondary"}>
          {user.isActive ? "Activo" : "Inactivo"}
        </ToneBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "w-24",
      cell: (user) => (
        <div className="flex items-center justify-end gap-0.5">
          <ScreenLink
            screenId="USR-03"
            search={{ id: String(user.id) }}
            aria-label={`Editar usuario ${user.username}`}
            title="Editar"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <Pencil />
          </ScreenLink>
          {user.id === self.id || user.role === "root" ? null : (
            <ConfirmDeleteButton
              label={`Eliminar usuario ${user.username}`}
              title="Confirmar eliminación"
              description={`¿Estás seguro que deseas eliminar al usuario ${user.username}? Esta acción no se puede deshacer.`}
              onConfirm={() =>
                reportDelete(deleteUser(user.id), "Usuario eliminado", user.username)
              }
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <ScreenPage
      screenId="USR-01"
      title={title}
      description={
        filterRole
          ? `Mostrando ${ROLE_PLURAL[filterRole].toLowerCase()}`
          : isRoot
            ? "Administración de todos los usuarios del sistema"
            : `Usuarios de ${ownInstitution?.name ?? "tu institución"}`
      }
      actions={
        <>
          <ScreenLinkButton screenId="USR-04">
            <FileSpreadsheet data-icon="inline-start" />
            Importar Excel
          </ScreenLinkButton>
          <ScreenLinkButton
            screenId="USR-02"
            variant="default"
            search={filterRole ? { rol: filterRole } : undefined}
          >
            <Plus data-icon="inline-start" />
            {filterRole ? `Nuevo ${ROLE_LABEL[filterRole]}` : "Nuevo Usuario"}
          </ScreenLinkButton>
        </>
      }
    >
      {!isRoot && ownInstitution ? (
        <InstitutionBanner institution={ownInstitution} badge="Admin" />
      ) : null}
      <StatGrid>
        <StatTile label="Total Usuarios" value={scoped.length} icon={Users} />
        <StatTile label="Profesores" value={count("teacher")} icon={UserRound} tone="warning" />
        <StatTile label="Estudiantes" value={count("student")} icon={GraduationCap} tone="info" />
        <StatTile
          label="Activos"
          value={scoped.filter((user) => user.isActive).length}
          icon={Activity}
          tone="success"
        />
      </StatGrid>
      <SectionCard
        title="Lista de Usuarios"
        action={<Badge variant="secondary">{rows.length} usuarios</Badge>}
      >
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Buscar por nombre, apellido, email o username"
        >
          <NativeSelect
            aria-label="Filtrar por rol"
            value={filterRole ?? ""}
            onChange={(event) => goTo("USR-01", { rol: event.target.value || undefined })}
          >
            <NativeSelectOption value="">Todos los roles</NativeSelectOption>
            {roleFilterOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {ROLE_LABEL[option]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterBar>
        <SimpleTable
          columns={columns}
          rows={rows}
          getRowId={(user) => user.id}
          pageSize={10}
          empty={
            <EmptyBlock
              icon={<Users />}
              title="No hay usuarios registrados"
              description={
                query || filterRole
                  ? "Ningún usuario coincide con los filtros."
                  : isRoot
                    ? "Comienza creando el primer usuario del sistema."
                    : "No hay usuarios en tu institución. Crea el primer usuario."
              }
              action={
                query || filterRole ? undefined : (
                  <ScreenLinkButton screenId="USR-02" variant="default">
                    Crear Primer Usuario
                  </ScreenLinkButton>
                )
              }
            />
          }
        />
      </SectionCard>
    </ScreenPage>
  );
}
