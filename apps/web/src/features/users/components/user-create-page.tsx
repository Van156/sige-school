import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import {
  ActiveInstitutionGuard,
  FormPageLayout,
  INVALID_FORM_MESSAGE,
} from "@/features/institution";
import PageHeader from "@/shared/components/layout/page-header";

import { createdUserNotice } from "../lib/user-create-flow";
import { emptyUserForm, toUserCreateInput } from "../lib/user-form";
import type { AssignableRole } from "../lib/user-roles";
import { LiveEmailAvailability, LiveUsernamePreview } from "./live-user-hints";
import { UserHowItWorksCard, UserRolesCard } from "./user-help-cards";
import UserForm from "./user-form";

/**
 * USR-02 `/usuarios/nuevo` (container): creates one user through `user.create`. `role` is the
 * `?role=` preselect. A student also lands back on the list (D8): the academic profile (STU-03)
 * does not exist yet, so the toast only says it is pending. Unreachable without `user:create`.
 */
export default function UserCreatePage({ role }: { role?: AssignableRole }) {
  return (
    <ActiveInstitutionGuard pageName="sus usuarios">
      <CanGate
        permission="user:create"
        message="No tienes permiso para crear usuarios en esta institución."
      >
        <PageHeader
          title="Crear Nuevo Usuario"
          description="Complete los datos para registrar un nuevo usuario en el sistema"
          breadcrumbs={[{ label: "Usuarios", to: "/usuarios" }, { label: "Nuevo Usuario" }]}
          actions={<BackToList />}
        />
        <CreateUser role={role} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function BackToList() {
  return (
    <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft data-icon="inline-start" />
      Volver a la Lista
    </Link>
  );
}

function CreateUser({ role }: { role?: AssignableRole }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createMutation = useMutation(orpc.user.create.mutationOptions());

  return (
    <FormPageLayout
      form={
        <UserForm
          // A different `?role=` is a different form: remount so the preselect applies.
          key={role ?? "none"}
          mode="create"
          initialValues={emptyUserForm(role)}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          renderUsernamePreview={(parts) => <LiveUsernamePreview {...parts} />}
          renderEmailStatus={(email) => <LiveEmailAvailability email={email} />}
          onSubmit={async (values) => {
            const created = await createMutation.mutateAsync(toUserCreateInput(values));
            const notice = createdUserNotice(created);
            toast.success(notice.title, { description: notice.description });
            await queryClient.invalidateQueries({ queryKey: orpc.user.key() });
            await navigate({ to: "/usuarios" });
          }}
        />
      }
      help={
        <>
          <UserHowItWorksCard />
          <UserRolesCard />
        </>
      }
    />
  );
}
