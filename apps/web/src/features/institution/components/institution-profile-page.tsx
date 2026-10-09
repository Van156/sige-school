import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Building2, CalendarDays, GraduationCap, Layers, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { useCan } from "@/features/access-control";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";

import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import { profileToFormValues } from "../lib/profile-form";
import ActiveInstitutionGuard from "./active-institution-guard";
import FormPageLayout, { HelpCard } from "./form-page-layout";
import InstitutionProfileForm from "./institution-profile-form";
import LogoField from "./logo-field";

/** INS-06 "Enlaces Rápidos"; each structure task adds its entry with its route (no dead links). */
const QUICK_LINKS = [
  { to: "/sedes", label: "Gestionar Sedes", icon: Building2 },
  { to: "/niveles", label: "Gestionar Niveles", icon: Layers },
  { to: "/cursos", label: "Gestionar Grados", icon: GraduationCap },
  { to: "/asignaturas", label: "Gestionar Asignaturas", icon: BookOpen },
  { to: "/periodos", label: "Gestionar Periodos", icon: CalendarDays },
  { to: "/criterios", label: "Criterios de Evaluación", icon: ListChecks },
] as const;

/**
 * INS-06 `/configuracion-institucion` (container): the active institution's profile. Saving goes
 * through `institution.update`; the logo is uploaded and removed on its own
 * (`institution.setLogo` / `removeLogo`). Without `institution:update` the data is read-only.
 */
export default function InstitutionProfilePage() {
  return (
    <ActiveInstitutionGuard pageName="la configuración de la institución">
      <InstitutionProfileContent />
    </ActiveInstitutionGuard>
  );
}

function InstitutionProfileContent() {
  const queryClient = useQueryClient();
  const { can: canUpdate } = useCan("institution:update");
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const updateMutation = useMutation(orpc.institution.update.mutationOptions());
  const setLogoMutation = useMutation(orpc.institution.setLogo.mutationOptions());
  const removeLogoMutation = useMutation(orpc.institution.removeLogo.mutationOptions());

  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.institution.key() });

  return (
    <>
      <PageHeader
        title="Configuración de Institución"
        description="Datos principales de la institución educativa"
      />
      {profileQuery.isPending ? (
        <Loader />
      ) : profileQuery.isError ? (
        <LoadError
          message="No se pudo cargar la configuración."
          onRetry={() => void profileQuery.refetch()}
        />
      ) : (
        <FormPageLayout
          form={
            <InstitutionProfileForm
              initialValues={profileToFormValues(profileQuery.data)}
              readOnly={!canUpdate}
              onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
              onSubmit={async (input) => {
                await updateMutation.mutateAsync(input);
                toast.success("Configuración guardada");
                await refresh();
              }}
              logoField={
                <LogoField
                  logo={profileQuery.data.logo}
                  disabled={!canUpdate}
                  isBusy={setLogoMutation.isPending || removeLogoMutation.isPending}
                  onUpload={async (file) => {
                    await setLogoMutation.mutateAsync({ logo: file });
                    toast.success("Logo actualizado");
                    await refresh();
                  }}
                  onRemove={async () => {
                    await removeLogoMutation.mutateAsync(undefined);
                    toast.success("Logo eliminado");
                    await refresh();
                  }}
                />
              }
            />
          }
          help={
            <>
              <HelpCard title="Enlaces Rápidos">
                <QuickLinks />
              </HelpCard>
              <HelpCard title="Información">
                <p>
                  Estos datos aparecen en boletines, reportes y documentos oficiales de la
                  institución.
                </p>
              </HelpCard>
            </>
          }
        />
      )}
    </>
  );
}

function QuickLinks() {
  return (
    <div className="flex flex-col gap-2">
      {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={buttonVariants({ variant: "outline" })}>
          <Icon data-icon="inline-start" />
          {label}
        </Link>
      ))}
    </div>
  );
}
