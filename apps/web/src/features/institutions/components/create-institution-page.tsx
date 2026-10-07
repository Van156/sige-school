import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import PageHeader from "@/shared/components/layout/page-header";

import { institutionCreateErrorMessage } from "../lib/institution-form";
import type { CreatedInstitution } from "../types";
import InstitutionCreateForm, { type CreateInstitutionInput } from "./institution-create-form";
import InstitutionCreatedNotice from "./institution-created-notice";

/**
 * INS-02 `/admin/instituciones/nueva` (container, root only): creates the institution and its
 * rector with `institutionAdmin.create`, then shows the generated username. BAD_REQUEST and
 * CONFLICT messages come back inline through the form.
 */
export default function CreateInstitutionPage() {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<CreatedInstitution | null>(null);

  const createMutation = useMutation(
    orpc.institutionAdmin.create.mutationOptions({
      onSuccess: async (result) => {
        setCreated(result);
        toast.success("Institución creada");
        await queryClient.invalidateQueries({ queryKey: orpc.institutionAdmin.key() });
      },
    }),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nueva Institución"
        description="Complete los datos para crear la institución educativa"
        breadcrumbs={[
          { label: "Instituciones", to: "/admin/instituciones" },
          { label: "Nueva Institución" },
        ]}
      />
      {created ? (
        <InstitutionCreatedNotice created={created} />
      ) : (
        <InstitutionCreateForm
          onSubmit={async (input: CreateInstitutionInput) => {
            try {
              await createMutation.mutateAsync(input);
            } catch (error) {
              throw new Error(institutionCreateErrorMessage(error));
            }
          }}
        />
      )}
    </div>
  );
}
