import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate, useCan } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  FormPageLayout,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import ConfirmDialog from "@/shared/components/overlays/confirm-dialog";

import { useResetUserPassword } from "../hooks/use-reset-user-password";
import { useUserActivation } from "../hooks/use-user-activation";
import { toUserUpdateInput, userToFormValues } from "../lib/user-form";
import { isProtectedRole } from "../lib/user-roles";
import { userRowAccess } from "../lib/user-list";
import type { UserDetail } from "../types";
import ResetPasswordDialog from "./reset-password-dialog";
import { UserInfoCard, UserQuickActionsCard } from "./user-edit-cards";
import UserForm from "./user-form";
import UserSummaryStrip from "./user-summary-strip";

const PROTECTED_MESSAGE = "Los administradores de la institución solo los gestiona la plataforma.";

/**
 * USR-03 `/usuarios/$personId/editar` (container): edits one user through `user.update` (full
 * replace). The side card resets the password to the document number and enables or disables the
 * user, each only when the caller may. `owner`/`admin` rows are managed by the platform, so they
 * show a notice instead of the form (USR-R4). Unreachable without `user:update`.
 */
export default function UserEditPage({ personId }: { personId: string }) {
  return (
    <ActiveInstitutionGuard pageName="sus usuarios">
      <CanGate
        permission="user:update"
        message="No tienes permiso para editar usuarios en esta institución."
      >
        <EditUser personId={personId} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function Header({ user }: { user?: Pick<UserDetail, "username" | "name"> }) {
  return (
    <PageHeader
      title="Editar Usuario"
      description={user ? `Editando: ${user.username} - ${user.name}` : undefined}
      breadcrumbs={[{ label: "Usuarios", to: "/usuarios" }, { label: "Editar Usuario" }]}
      actions={
        <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft data-icon="inline-start" />
          Volver a la Lista
        </Link>
      }
    />
  );
}

function EditUser({ personId }: { personId: string }) {
  const detailQuery = useQuery(orpc.user.get.queryOptions({ input: { personId } }));

  if (detailQuery.isPending) {
    return (
      <>
        <Header />
        <Loader />
      </>
    );
  }
  // A failed background refetch keeps the cached user (and the unsaved edits on screen).
  if (detailQuery.isError && detailQuery.data === undefined) {
    return (
      <>
        <Header />
        {(detailQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
          <EmptyState
            icon={<UserX />}
            title="Usuario no encontrado"
            description="El usuario no existe o ya fue eliminado."
            action={
              <Link to="/usuarios" className={buttonVariants()}>
                Volver a Usuarios
              </Link>
            }
          />
        ) : (
          <LoadError
            message="No se pudo cargar el usuario."
            onRetry={() => void detailQuery.refetch()}
          />
        )}
      </>
    );
  }

  // Type narrowing only: past the pending and error branches `data` is always defined, except
  // for a failed refetch of a cached user (kept on screen on purpose), which still has data.
  const user = detailQuery.data;
  if (user === undefined) {
    return null;
  }
  return (
    <>
      <Header user={user} />
      {isProtectedRole(user.role) ? (
        <EmptyState
          icon={<ShieldAlert />}
          title="No puedes editar este usuario"
          description={PROTECTED_MESSAGE}
          action={
            <Link to="/usuarios" className={buttonVariants()}>
              Volver a Usuarios
            </Link>
          }
        />
      ) : (
        <EditUserForm key={user.personId} user={user} />
      )}
    </>
  );
}

function EditUserForm({ user }: { user: UserDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const updateMutation = useMutation(orpc.user.update.mutationOptions());
  const canReset = useCan("user:reset_password").can;
  const activation = useUserActivation();
  const resetPassword = useResetUserPassword(user.personId);
  const [resetOpen, setResetOpen] = useState(false);

  // The caller reached this page with `user:update`, so only the row rules narrow the action.
  const canToggle = userRowAccess(user, { canUpdate: true, canDelete: false }).canActivate;

  return (
    <>
      <FormPageLayout
        form={
          <UserForm
            mode="edit"
            initialValues={userToFormValues(user)}
            header={<UserSummaryStrip user={user} />}
            onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync(toUserUpdateInput(user.personId, values));
              toast.success("Usuario actualizado");
              await queryClient.invalidateQueries({ queryKey: orpc.user.key() });
              await navigate({ to: "/usuarios" });
            }}
          />
        }
        help={
          <>
            <UserQuickActionsCard
              isActive={user.isActive}
              onResetPassword={canReset ? () => setResetOpen(true) : undefined}
              onToggleActive={canToggle ? () => activation.request(user) : undefined}
            />
            <UserInfoCard user={user} />
          </>
        }
      />
      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        mode="document"
        userLabel={user.name}
        onSubmit={resetPassword}
      />
      <ConfirmDialog
        {...activation.dialog}
        title={activation.copy?.title ?? ""}
        description={activation.copy?.description}
        confirmLabel={activation.copy?.confirmLabel}
        cancelLabel="Cancelar"
        destructive={activation.copy?.active === false}
      />
    </>
  );
}
