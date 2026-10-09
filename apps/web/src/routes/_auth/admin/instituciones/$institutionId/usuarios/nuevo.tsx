import { createFileRoute } from "@tanstack/react-router";

import { InstitutionUserCreatePage } from "@/features/institutions";

export const Route = createFileRoute("/_auth/admin/instituciones/$institutionId/usuarios/nuevo")({
  component: RouteComponent,
});

function RouteComponent() {
  return <InstitutionUserCreatePage institutionId={Route.useParams().institutionId} />;
}
