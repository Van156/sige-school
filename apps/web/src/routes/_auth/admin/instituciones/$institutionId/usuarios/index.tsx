import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { InstitutionUsersPage } from "@/features/institutions";
import { userSearchDefaults, userSearchSchema } from "@/features/users";

export const Route = createFileRoute("/_auth/admin/instituciones/$institutionId/usuarios/")({
  validateSearch: userSearchSchema,
  search: { middlewares: [stripSearchParams(userSearchDefaults)] },
  component: RouteComponent,
});

function RouteComponent() {
  const { institutionId } = Route.useParams();
  return <InstitutionUsersPage institutionId={institutionId} search={Route.useSearch()} />;
}
