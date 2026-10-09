import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { INVALID_FORM_MESSAGE, InstitutionBanner } from "@/features/institution";
import { LiveUsernamePreview } from "@/features/users";
import PageHeader from "@/shared/components/layout/page-header";

import { platformUsernamePreview } from "../hooks/platform-username-preview";
import {
  emptyPlatformUserForm,
  platformCreatedNotice,
  toPlatformUserCreateInput,
} from "../lib/platform-user";
import type { InstitutionDetail } from "../types";
import InstitutionLoader from "./institution-loader";
import PlatformUserForm from "./platform-user-form";

/**
 * INS-05 `/admin/instituciones/$institutionId/usuarios/nuevo` (container, root only): creates a
 * user in the institution through `platformUser.create`. Every outcome returns to INS-04; a
 * student's toast asks to complete the academic profile from the institution (STU-03 needs its
 * context).
 */
export default function InstitutionUserCreatePage({ institutionId }: { institutionId: string }) {
  return (
    <InstitutionLoader institutionId={institutionId}>
      {(institution) => <CreateInstitutionUser institution={institution} />}
    </InstitutionLoader>
  );
}

function CreateInstitutionUser({ institution }: { institution: InstitutionDetail }) {
  const institutionId = institution.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createMutation = useMutation(orpc.platformUser.create.mutationOptions());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Crear Usuario en ${institution.name}`}
        description={`Crear nuevo usuario para ${institution.name}`}
        breadcrumbs={[
          { label: "Instituciones", to: "/admin/instituciones" },
          { label: "Nuevo Usuario" },
        ]}
        actions={
          <Link
            to="/admin/instituciones/$institutionId/usuarios"
            params={{ institutionId }}
            className={buttonVariants({ variant: "outline" })}
          >
            <ArrowLeft data-icon="inline-start" />
            Volver
          </Link>
        }
      />
      <InstitutionBanner
        name={institution.name}
        logo={institution.logo}
        municipality={institution.municipality}
        department={institution.department}
        nit={institution.nit}
        badge="Root Admin"
      />
      <PlatformUserForm
        institutionId={institutionId}
        initialValues={emptyPlatformUserForm()}
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        renderUsernamePreview={(parts) => (
          <LiveUsernamePreview {...parts} queryFor={platformUsernamePreview(institutionId)} />
        )}
        onSubmit={async (values) => {
          const created = await createMutation.mutateAsync(
            toPlatformUserCreateInput(institutionId, values),
          );
          const notice = platformCreatedNotice(created);
          toast.success(notice.title, { description: notice.description });
          await queryClient.invalidateQueries({ queryKey: orpc.platformUser.key() });
          await navigate({
            to: "/admin/instituciones/$institutionId/usuarios",
            params: { institutionId },
          });
        }}
      />
    </div>
  );
}
