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
import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { GraduationCap, KeyRound, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Callout } from "../../-components/callout";
import { ConfirmDeleteButton } from "../../-components/confirm-delete";
import { EmptyBlock } from "../../-components/empty-block";
import { FilterBar } from "../../-components/filter-bar";
import { BackButton } from "../../-components/form-layout";
import { InstitutionBanner } from "../../-components/institution-banner";
import { ScreenLinkButton } from "../../-components/link-button";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScreenPage } from "../../-components/scoped-page";
import { ScreenLink } from "../../-components/sige-link";
import { SectionCard } from "../../-components/section-card";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { StatGrid, StatTile } from "../../-components/stat-tile";
import { ToneBadge, RoleBadge } from "../../-components/tone-badge";
import { UserCell } from "../../-components/user-cell";
import { reportDelete } from "../../-lib/delete-report";
import { matchesQuery } from "../../-lib/list";
import { useIdParam } from "../../-lib/use-search-params";
import {
  deleteUser,
  institutionStore,
  mockAction,
  userStore,
  useMockCollection,
} from "../../-mock";
import { fullName } from "../../-mock/people";
import type { Institution, User } from "../../-mock/types";
import { buttonVariants } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import { Pencil } from "lucide-react";

/** INS-04: users assigned to one institution (root), with password reset and delete. */
export function InstitutionUsersScreen() {
  const id = useIdParam();
  const institutions = useMockCollection(institutionStore);
  const institution = id === undefined ? undefined : institutions.find((entry) => entry.id === id);

  return (
    <ScreenPage
      screenId="INS-04"
      title={institution ? `Usuarios de ${institution.name}` : "Usuarios de la institución"}
      description="Gestión de usuarios asignados a esta institución"
      actions={
        <>
          {institution ? (
            <ScreenLinkButton
              screenId="INS-05"
              search={{ id: String(institution.id) }}
              variant="default"
            >
              <Plus data-icon="inline-start" />
              Nuevo Admin
            </ScreenLinkButton>
          ) : null}
          <BackButton screenId="INS-01" />
        </>
      }
    >
      {institution ? (
        <InstitutionUsers institution={institution} />
      ) : (
        <NotFoundBlock entity="Institución" feminine backScreenId="INS-01" />
      )}
    </ScreenPage>
  );
}

function InstitutionUsers({ institution }: { institution: Institution }) {
  const userList = useMockCollection(userStore);
  const [query, setQuery] = useState("");
  const [passwordFor, setPasswordFor] = useState<User | null>(null);

  const own = userList.filter((user) => user.institutionId === institution.id);
  const count = (role: User["role"]) => own.filter((user) => user.role === role).length;
  const rows = own.filter((user) => matchesQuery(query, user.username, user.email, fullName(user)));

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
      className: "w-32",
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Cambiar contraseña de ${user.username}`}
            title="Cambiar contraseña"
            onClick={() => setPasswordFor(user)}
          >
            <KeyRound />
          </Button>
          {user.role === "root" ? null : (
            <ConfirmDeleteButton
              label={`Eliminar usuario ${user.username}`}
              title="¿Eliminar usuario?"
              description={`Se eliminará ${user.username}. Esta acción no se puede deshacer.`}
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
    <>
      <InstitutionBanner institution={institution} badge="Root Admin" />
      <StatGrid>
        <StatTile
          label="Administradores"
          value={count("admin")}
          icon={ShieldCheck}
          tone="success"
        />
        <StatTile label="Coordinadores" value={count("coordinator")} icon={Users} tone="info" />
        <StatTile label="Profesores" value={count("teacher")} icon={UserRound} tone="warning" />
        <StatTile label="Estudiantes" value={count("student")} icon={GraduationCap} />
      </StatGrid>
      <SectionCard
        title="Lista de Usuarios"
        action={<Badge variant="secondary">{own.length} usuarios</Badge>}
      >
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Buscar por nombre, email o usuario"
        />
        <SimpleTable
          columns={columns}
          rows={rows}
          getRowId={(user) => user.id}
          pageSize={10}
          empty={
            <EmptyBlock
              icon={<Users />}
              title={query ? "Sin resultados" : "No hay usuarios en esta institución"}
              description={
                query
                  ? "Ningún usuario coincide con la búsqueda."
                  : "Comienza creando un administrador para esta institución."
              }
              action={
                query ? undefined : (
                  <ScreenLinkButton
                    screenId="INS-05"
                    search={{ id: String(institution.id) }}
                    variant="default"
                  >
                    Crear Primer Admin
                  </ScreenLinkButton>
                )
              }
            />
          }
        />
      </SectionCard>
      <ChangePasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />
    </>
  );
}

function ChangePasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>{user ? <PasswordForm user={user} onClose={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function PasswordForm({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const invalid = submitted && password.length < 6;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (password.length < 6) return;
    userStore.update(user.id, { mustChangePassword: true });
    mockAction(
      "Contraseña actualizada",
      `${user.username} deberá cambiarla en su próximo inicio de sesión.`,
    );
    onClose();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Cambiar Contraseña</DialogTitle>
        <DialogDescription>Restablece la contraseña de {fullName(user)}.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="pw-user">Usuario</FieldLabel>
        <Input id="pw-user" value={user.username} readOnly />
      </Field>
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="pw-new">Nueva Contraseña *</FieldLabel>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={password}
          aria-invalid={invalid}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FieldDescription>La contraseña debe tener al menos 6 caracteres</FieldDescription>
      </Field>
      <Callout tone="info">
        El usuario deberá cambiar esta contraseña en su próximo inicio de sesión.
      </Callout>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Actualizar Contraseña</Button>
      </DialogFooter>
    </form>
  );
}
