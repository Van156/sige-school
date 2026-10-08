import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { FormPageLayout, HelpCard, INVALID_FORM_MESSAGE, LogoField } from "@/features/institution";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { useObjectUrl } from "../hooks/use-object-url";
import { createInstitutionWithLogo } from "../lib/create-flow";
import { formatCreatedDate } from "../lib/institution-format";
import { emptyInstitutionForm, institutionToFormValues } from "../lib/institution-form";
import type { CreatedInstitution, InstitutionDetail } from "../types";
import InstitutionCreatedNotice from "./institution-created-notice";
import InstitutionForm from "./institution-form";

const LOGO_FAILED_MESSAGE = "No se pudo subir el logo. Puedes subirlo desde Editar Institución.";

/**
 * INS-02 `/admin/instituciones/nueva` and `/admin/instituciones/$institutionId/editar`
 * (container, root only): create when `institutionId` is omitted, else edit. Create runs
 * `institutionAdmin.create` and then uploads the optional logo; edit saves the profile and
 * uploads or removes the logo on its own (`institutionAdmin.setLogo` / `removeLogo`).
 */
export default function InstitutionFormPage({ institutionId }: { institutionId?: string }) {
  const title = institutionId === undefined ? "Nueva Institución" : "Editar Institución";
  return (
    <>
      <PageHeader
        title={title}
        description={
          institutionId === undefined
            ? "Complete los datos para crear la institución educativa"
            : "Modifique los datos de la institución educativa"
        }
        breadcrumbs={[{ label: "Instituciones", to: "/admin/instituciones" }, { label: title }]}
      />
      {institutionId === undefined ? (
        <CreateInstitution />
      ) : (
        <EditInstitution institutionId={institutionId} />
      )}
    </>
  );
}

function CreateInstitution() {
  const queryClient = useQueryClient();
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const preview = useObjectUrl(pendingLogo);
  const [created, setCreated] = useState<{
    institution: CreatedInstitution;
    logoUploaded: boolean;
  } | null>(null);

  const createMutation = useMutation(orpc.institutionAdmin.create.mutationOptions());
  const setLogoMutation = useMutation(orpc.institutionAdmin.setLogo.mutationOptions());

  if (created) {
    return (
      <InstitutionCreatedNotice
        created={created.institution}
        logoWarning={created.logoUploaded ? undefined : LOGO_FAILED_MESSAGE}
      />
    );
  }
  return (
    <FormPageLayout
      form={
        <InstitutionForm
          mode="create"
          initialValues={emptyInstitutionForm()}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          logoField={
            <LogoField
              logo={preview}
              currentLabel="Logo seleccionado:"
              onUpload={async (file) => setPendingLogo(file)}
              onRemove={async () => setPendingLogo(null)}
            />
          }
          onSubmit={async (input) => {
            const { result, logoUploaded } = await createInstitutionWithLogo(
              {
                create: (value) => createMutation.mutateAsync(value),
                setLogo: (id, logo) => setLogoMutation.mutateAsync({ id, logo }),
              },
              input,
              pendingLogo,
            );
            toast.success("Institución creada");
            if (!logoUploaded) {
              toast.warning(LOGO_FAILED_MESSAGE);
            }
            setCreated({ institution: result, logoUploaded });
            await queryClient.invalidateQueries({ queryKey: orpc.institutionAdmin.key() });
          }}
        />
      }
      help={
        <>
          <WhatIsAnInstitution />
          <HelpCard title="Seguridad del Admin">
            <p>
              El administrador inicia con su número de documento como contraseña y deberá cambiarla
              en su primer inicio de sesión.
            </p>
          </HelpCard>
        </>
      }
    />
  );
}

function EditInstitution({ institutionId }: { institutionId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const detailQuery = useQuery(
    orpc.institutionAdmin.get.queryOptions({ input: { id: institutionId } }),
  );
  const updateMutation = useMutation(orpc.institutionAdmin.update.mutationOptions());
  const setLogoMutation = useMutation(orpc.institutionAdmin.setLogo.mutationOptions());
  const removeLogoMutation = useMutation(orpc.institutionAdmin.removeLogo.mutationOptions());

  if (detailQuery.isPending) {
    return <Loader />;
  }
  if (detailQuery.isError) {
    return (detailQuery.error as { code?: unknown }).code === "NOT_FOUND" ? (
      <EmptyState
        icon={<Building2 />}
        title="Institución no encontrada"
        description="La institución no existe o ya fue eliminada."
        action={
          <Link to="/admin/instituciones" className={buttonVariants()}>
            Volver a Instituciones
          </Link>
        }
      />
    ) : (
      <LoadError
        message="No se pudo cargar la institución."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const institution = detailQuery.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.institutionAdmin.key() });
  return (
    <FormPageLayout
      form={
        <InstitutionForm
          mode="edit"
          initialValues={institutionToFormValues(institution)}
          onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
          logoField={
            <LogoField
              logo={institution.logo}
              isBusy={setLogoMutation.isPending || removeLogoMutation.isPending}
              onUpload={async (logo) => {
                await setLogoMutation.mutateAsync({ id: institutionId, logo });
                toast.success("Logo actualizado");
                await refresh();
              }}
              onRemove={async () => {
                await removeLogoMutation.mutateAsync({ id: institutionId });
                toast.success("Logo eliminado");
                await refresh();
              }}
            />
          }
          onSubmit={async (input) => {
            await updateMutation.mutateAsync({ id: institutionId, ...input });
            toast.success("Institución actualizada");
            await refresh();
            await navigate({ to: "/admin/instituciones" });
          }}
        />
      }
      help={
        <>
          <InstitutionInfo institution={institution} />
          <WhatIsAnInstitution />
        </>
      }
    />
  );
}

function InstitutionInfo({ institution }: { institution: InstitutionDetail }) {
  return (
    <HelpCard title="Información">
      <InfoRow label="ID">
        <span className="font-mono text-xs break-all">{institution.id}</span>
      </InfoRow>
      <InfoRow label="Creada">{formatCreatedDate(institution.createdAt)}</InfoRow>
      <InfoRow label="Sedes">{institution.counts.campuses}</InfoRow>
    </HelpCard>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function WhatIsAnInstitution() {
  return (
    <HelpCard title="¿Qué es una Institución?">
      <p>Una institución educativa registrada en el sistema, con su propia información.</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>Agrupa sus sedes, grados, asignaturas y periodos.</li>
        <li>Tiene un administrador (Rector) que la gestiona.</li>
        <li>Sus datos aparecen en boletines y reportes oficiales.</li>
      </ul>
    </HelpCard>
  );
}
