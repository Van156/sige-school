import { createFileRoute } from "@tanstack/react-router";

import { InstitutionFormPage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/$institutionId/editar")({
  component: EditInstitutionRoute,
});

function EditInstitutionRoute() {
  const { institutionId } = Route.useParams();
  return <InstitutionFormPage institutionId={institutionId} />;
}
